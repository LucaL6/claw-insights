import type { DatabaseSync as Database } from 'node:sqlite';

import { config } from '../config.js';
import { getBucketedEventCount, getBucketedGatewayEvents } from '../db/event-queries.js';
import { bucketLabel, type MetricsRangeKey, RANGE_CONFIG, rangeStart } from '../db/query-utils.js';
import { getBucketedSessions } from '../db/system-queries.js';
import { getBucketedModelTokenUsage, getBucketedTokenUsage, getRangeTokenUsageK } from '../db/token-queries.js';

export class Aggregator {
  private cache: { key: string; data: unknown; ts: number } | null = null;
  constructor(private db: Database) {}

  clearCache() {
    this.cache = null;
  }

  getMetrics(date?: string, range: MetricsRangeKey = 'TWENTY_FOUR_HOUR') {
    const day = date ?? new Date().toISOString().split('T')[0];
    const cacheKey = `metrics:${day}:${range}`;
    if (this.cache && this.cache.key === cacheKey && Date.now() - this.cache.ts < 60_000) {
      return this.cache.data;
    }

    const rangeConfig = RANGE_CONFIG[range];
    const startTs = rangeStart(range);
    const endTs = new Date(Date.now() + 1000).toISOString();

    // Decide whether to read from hourly rollup tables
    const rangeMinutes = rangeConfig.rangeMinutes;
    const rawRetentionMinutes = config.rawRetentionDays * 24 * 60;
    const useHourly = rawRetentionMinutes > 0 && rangeMinutes > rawRetentionMinutes;

    // Determine which buckets fall in range (epoch-based)
    const bucketSeconds = rangeConfig.bucketMinutes * 60;
    const startEpoch = Math.floor(new Date(startTs).getTime() / 1000);
    const endEpoch = Math.floor(new Date(endTs).getTime() / 1000);
    const startBucket = Math.floor(startEpoch / bucketSeconds);
    const endBucket = Math.floor(endEpoch / bucketSeconds);

    const errors = new Map(
      getBucketedEventCount(this.db, startTs, endTs, 'error', rangeConfig.bucketMinutes).map((r) => [
        r.bucket,
        r.count,
      ]),
    );
    const warnings = new Map(
      getBucketedEventCount(this.db, startTs, endTs, 'warning', rangeConfig.bucketMinutes).map((r) => [
        r.bucket,
        r.count,
      ]),
    );
    const sessions = new Map(
      getBucketedSessions(this.db, startTs, endTs, rangeConfig.bucketMinutes, useHourly).map((r) => [
        r.bucket,
        r.sessions,
      ]),
    );
    const tokens = new Map(
      getBucketedTokenUsage(this.db, startTs, endTs, rangeConfig.bucketMinutes).map((r) => [r.bucket, r.tokensK]),
    );
    const modelTokens = getBucketedModelTokenUsage(this.db, startTs, endTs, rangeConfig.bucketMinutes);
    const modelByBucket = new Map<number, Array<{ model: string; tokensK: number }>>();
    for (const mt of modelTokens) {
      if (!modelByBucket.has(mt.bucket)) {
        modelByBucket.set(mt.bucket, []);
      }
      modelByBucket.get(mt.bucket)!.push({ model: mt.model, tokensK: mt.tokensK });
    }
    const apiCalls = new Map(
      getBucketedEventCount(this.db, startTs, endTs, 'api_call', rangeConfig.bucketMinutes).map((r) => [
        r.bucket,
        r.count,
      ]),
    );
    const toolCalls = new Map(
      getBucketedEventCount(this.db, startTs, endTs, 'tool_call', rangeConfig.bucketMinutes).map((r) => [
        r.bucket,
        r.count,
      ]),
    );
    const gwEvents = getBucketedGatewayEvents(this.db, startTs, endTs, rangeConfig.bucketMinutes);
    const restartBuckets = new Set(gwEvents.filter((e) => e.type === 'gateway_restart').map((e) => e.bucket));

    // Build bucket array — linear epoch-based iteration
    const buckets: Array<Record<string, unknown>> = [];
    for (let b = startBucket; b <= endBucket; b++) {
      buckets.push({
        bucket: b - startBucket,
        label: bucketLabel(b, rangeConfig.bucketMinutes),
        epochStart: b * bucketSeconds,
        sessions: sessions.get(b) ?? 0,
        tokensK: tokens.get(b) ?? 0,
        tokensByModel: modelByBucket.get(b) ?? [],
        apiCalls: apiCalls.get(b) ?? 0,
        toolCalls: toolCalls.get(b) ?? 0,
        errors: errors.get(b) ?? 0,
        warnings: warnings.get(b) ?? 0,
        gatewayUp: true,
        restartEvent: restartBuckets.has(b),
      });
    }

    // Compute timezone label e.g. "UTC+8" or "UTC-5"
    const offsetMin = -new Date().getTimezoneOffset();
    const sign = offsetMin >= 0 ? '+' : '-';
    const absH = Math.floor(Math.abs(offsetMin) / 60);
    const absM = Math.abs(offsetMin) % 60;
    const timezone = absM === 0 ? `UTC${sign}${absH}` : `UTC${sign}${absH}:${absM.toString().padStart(2, '0')}`;

    const rangeTokensK = getRangeTokenUsageK(this.db, startTs, endTs);
    const summary = {
      date: day,
      range,
      bucketMinutes: rangeConfig.bucketMinutes,
      timezone,
      buckets,
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
