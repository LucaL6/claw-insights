import type { LogEntry } from '@openclaw-dashboard/shared';
import type { Database } from 'bun:sqlite';
import { insertEvent, getHourlyCount, getHourlySum, getGatewayEvents, getHourlySampledSessions, getHourlySampledTokens } from '../db/queries.js';

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

  getMetrics(date?: string) {
    const day = date ?? new Date().toISOString().split('T')[0];
    const cacheKey = `metrics:${day}`;
    if (this.cache && this.cache.key === cacheKey && Date.now() - this.cache.ts < 60_000) {
      return this.cache.data;
    }

    const errors = new Map(getHourlyCount(this.db, day, 'error').map((r) => [r.hour, r.count]));
    const warnings = new Map(getHourlyCount(this.db, day, 'warning').map((r) => [r.hour, r.count]));
    const sampledSessions = getHourlySampledSessions(this.db, day);
    const sampledTokens = getHourlySampledTokens(this.db, day);
    const sessions = new Map(sampledSessions.map((r) => [r.hour, r.sessions]));
    const tokens = new Map(sampledTokens.map((r) => [r.hour, r.tokensK]));
    const apiCalls = new Map(getHourlyCount(this.db, day, 'api_call').map((r) => [r.hour, r.count]));
    const toolCalls = new Map(getHourlyCount(this.db, day, 'tool_call').map((r) => [r.hour, r.count]));
    const gwEvents = getGatewayEvents(this.db, day);
    const restartHours = new Set(gwEvents.filter((e) => e.type === 'gateway_restart').map((e) => e.hour));

    const hours = Array.from({ length: 24 }, (_, hour) => ({
      hour,
      sessions: sessions.get(hour) ?? 0,
      tokensK: Number(tokens.get(hour) ?? 0),
      apiCalls: apiCalls.get(hour) ?? 0,
      toolCalls: toolCalls.get(hour) ?? 0,
      errors: errors.get(hour) ?? 0,
      warnings: warnings.get(hour) ?? 0,
      gatewayUp: true,
      restartEvent: restartHours.has(hour),
    }));

    const summary = {
      date: day,
      hours,
      totalTokensK: Math.max(...hours.map(h => h.tokensK), 0),
      totalErrors: hours.reduce((s, h) => s + h.errors, 0),
      totalWarnings: hours.reduce((s, h) => s + h.warnings, 0),
      uptimePercent: 100,
    };
    this.cache = { key: cacheKey, data: summary, ts: Date.now() };
    return summary;
  }
}
