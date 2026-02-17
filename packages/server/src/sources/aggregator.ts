import type { LogEntry } from '@claw-insights/shared';
import type { Database } from 'bun:sqlite';
import {
  insertEvent,
  getBucketedEventCount, getBucketedSampledSessions, getBucketedSampledTokens, getBucketedGatewayEvents,
  getBucketedModelTokens, getRangeTokensK,
  bucketLabel, RANGE_CONFIG, rangeStart,
  type MetricsRangeKey,
} from '../db/queries.js';

export class Aggregator {
  private cache: { key: string; data: unknown; ts: number } | null = null;
  constructor(private db: Database) {}

  clearCache() {
    this.cache = null;
  }

  ingestLog(entry: LogEntry) {
    const msg = entry.message;
    if (entry.level === 'ERROR') insertEvent(this.db, 'error', null, { module: entry.module, message: msg });
    if (entry.level === 'WARN') insertEvent(this.db, 'warning', null, { module: entry.module, message: msg });
    // Removed: run start, totalTokens patterns — now sampled via MetricsCollector
    if (msg.includes('tool start')) insertEvent(this.db, 'tool_call', 1, { module: entry.module });
    if (msg.includes('embedded run tool start')) insertEvent(this.db, 'api_call', 1, { module: entry.module });
    if (msg.includes('gateway restart')) insertEvent(this.db, 'gateway_restart', null, {});
  }

  getMetrics(date?: string, range: MetricsRangeKey = 'TWENTY_FOUR_HOUR') {
    const day = date ?? new Date().toISOString().split('T')[0];
    const cacheKey = `metrics:${day}:${range}`;
    if (this.cache && this.cache.key === cacheKey && Date.now() - this.cache.ts < 60_000) {
      return this.cache.data;
    }

    const config = RANGE_CONFIG[range];
    const startTs = rangeStart(range);
    const endTs = new Date(Date.now() + 1000).toISOString();

    // Determine which buckets fall in range (epoch-based)
    const bucketSeconds = config.bucketMinutes * 60;
    const startEpoch = Math.floor(new Date(startTs).getTime() / 1000);
    const endEpoch = Math.floor(new Date(endTs).getTime() / 1000);
    const startBucket = Math.floor(startEpoch / bucketSeconds);
    const endBucket = Math.floor(endEpoch / bucketSeconds);

    const errors = new Map(getBucketedEventCount(this.db, startTs, endTs, 'error', config.bucketMinutes).map((r) => [r.bucket, r.count]));
    const warnings = new Map(getBucketedEventCount(this.db, startTs, endTs, 'warning', config.bucketMinutes).map((r) => [r.bucket, r.count]));
    const sessions = new Map(getBucketedSampledSessions(this.db, startTs, endTs, config.bucketMinutes).map((r) => [r.bucket, r.sessions]));
    const tokens = new Map(getBucketedSampledTokens(this.db, startTs, endTs, config.bucketMinutes).map((r) => [r.bucket, r.tokensK]));
    const modelTokens = getBucketedModelTokens(this.db, startTs, endTs, config.bucketMinutes);
    const modelByBucket = new Map<number, Array<{ model: string; tokensK: number }>>();
    for (const mt of modelTokens) {
      if (!modelByBucket.has(mt.bucket)) modelByBucket.set(mt.bucket, []);
      modelByBucket.get(mt.bucket)!.push({ model: mt.model, tokensK: Number(mt.tokensK) });
    }
    const apiCalls = new Map(getBucketedEventCount(this.db, startTs, endTs, 'api_call', config.bucketMinutes).map((r) => [r.bucket, r.count]));
    const toolCalls = new Map(getBucketedEventCount(this.db, startTs, endTs, 'tool_call', config.bucketMinutes).map((r) => [r.bucket, r.count]));
    const gwEvents = getBucketedGatewayEvents(this.db, startTs, endTs, config.bucketMinutes);
    const restartBuckets = new Set(gwEvents.filter((e) => e.type === 'gateway_restart').map((e) => e.bucket));

    // Build bucket array — linear epoch-based iteration
    const buckets: Array<Record<string, unknown>> = [];
    for (let b = startBucket; b <= endBucket; b++) {
      buckets.push({
        bucket: b - startBucket,
        label: bucketLabel(b, config.bucketMinutes),
        epochStart: b * bucketSeconds,
        sessions: sessions.get(b) ?? 0,
        tokensK: Number(tokens.get(b) ?? 0),
        tokensByModel: modelByBucket.get(b) ?? [],
        apiCalls: apiCalls.get(b) ?? 0,
        toolCalls: toolCalls.get(b) ?? 0,
        errors: errors.get(b) ?? 0,
        warnings: warnings.get(b) ?? 0,
        gatewayUp: true,
        restartEvent: restartBuckets.has(b),
      });
    }

    // Backward compat hours
    const hours = buckets.map((b, i) => ({ hour: i, ...b }));

    // Compute timezone label e.g. "UTC+8" or "UTC-5"
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const absH = Math.floor(Math.abs(offsetMin) / 60);
    const absM = Math.abs(offsetMin) % 60;
    const timezone = absM === 0 ? `UTC${sign}${absH}` : `UTC${sign}${absH}:${absM.toString().padStart(2, '0')}`;

    const rangeTokensK = getRangeTokensK(this.db, startTs, endTs);
    const summary = {
      date: day,
      range,
      bucketMinutes: config.bucketMinutes,
      timezone,
      buckets,
      hours,
      totalTokensK: buckets.reduce((s, h) => s + Number(h.tokensK ?? 0), 0),
      rangeTokensK,
      totalErrors: buckets.reduce((s, h) => s + Number(h.errors ?? 0), 0),
      totalWarnings: buckets.reduce((s, h) => s + Number(h.warnings ?? 0), 0),
      uptimePercent: 100,
    };
    this.cache = { key: cacheKey, data: summary, ts: Date.now() };
    return summary;
  }
}
