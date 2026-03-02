import { config } from '../config.js';
import type { AppContext } from '../context.js';
import { queryEvents } from '../db/event-queries.js';
import { getRangeTurnCount, getRangeTurnCountBySession } from '../db/message-queries.js';
import { type MetricsRangeKey, RANGE_CONFIG } from '../db/query-utils.js';
import { getCompanionSince } from '../db/system-queries.js';
import { getRangeModelTokenUsage, getRangeTokenUsageK } from '../db/token-queries.js';
import { createChildLogger } from '../logger.js';
import { resolveCompanionSince } from '../sources/companion-days.js';
import type { DataSources } from './snapshot-types.js';

const log = createChildLogger('snapshot-sources');
const VALID_RANGES = new Set<MetricsRangeKey>(Object.keys(RANGE_CONFIG) as MetricsRangeKey[]);

export function createSnapshotSources(ctx: AppContext): DataSources {
  // Channels are embedded in getGatewayStatus() response — cache to avoid duplicate CLI fork
  let cachedChannels: Awaited<ReturnType<DataSources['getChannels']>> | null | undefined;
  return {
    getGateway: async () => {
      const t0 = performance.now();
      try {
        const s = await ctx.gatewayClient.getGatewayStatus();
        const sys = await ctx.systemInfoService.getSystemMetrics();
        log.debug({ source: 'gateway', ms: Math.round(performance.now() - t0) }, 'collected');
        // Stash channels from the same request so getChannels() doesn't re-fetch
        cachedChannels = s.channels ?? [];
        return { ...s, cpu: sys.cpu, memoryMB: sys.memoryMB };
      } catch (err) {
        log.warn({ err }, 'failed to collect gateway data');
        cachedChannels = null;
        throw err;
      }
    },
    getChannels: async () => {
      // Reuse channels already fetched by getGateway() — avoids duplicate CLI fork
      if (cachedChannels !== undefined) {
        const result = cachedChannels;
        cachedChannels = undefined; // one-shot
        return result ?? [];
      }
      const t0 = performance.now();
      const channels = (await ctx.gatewayClient.getGatewayStatus()).channels;
      log.debug({ source: 'channels', ms: Math.round(performance.now() - t0) }, 'collected');
      return channels;
    },
    getSessions: () => {
      const t0 = performance.now();
      ctx.sessionReader.attachSubAgents(ctx.spawnTracker.getParentChildMap());
      const result = ctx.sessionReader.getSessions();
      log.debug({ source: 'sessions', ms: Math.round(performance.now() - t0) }, 'collected');
      return result;
    },
    getMetrics: (range: string) => {
      const t0 = performance.now();
      const validated: MetricsRangeKey = VALID_RANGES.has(range as MetricsRangeKey)
        ? (range as MetricsRangeKey)
        : 'TWENTY_FOUR_HOUR';
      const result = ctx.aggregator.getMetrics(undefined, validated) as ReturnType<DataSources['getMetrics']>;
      log.debug({ source: 'metrics', ms: Math.round(performance.now() - t0) }, 'collected');
      return result;
    },
    getRecentErrors: (limit: number) => {
      const t0 = performance.now();
      const result = queryEvents(ctx.db, { types: ['error', 'warning'], limit });
      log.debug({ source: 'recentErrors', ms: Math.round(performance.now() - t0) }, 'collected');
      return result;
    },
    getModelTokenUsage: (startTs: string, endTs: string) => getRangeModelTokenUsage(ctx.db, startTs, endTs),
    getTokenTrend: (rangeMinutes: number, endTs: string) => {
      const endMs = new Date(endTs).getTime();
      const currentStart = new Date(endMs - rangeMinutes * 60_000).toISOString();
      const prevStart = new Date(endMs - 2 * rangeMinutes * 60_000).toISOString();
      const current = getRangeTokenUsageK(ctx.db, currentStart, endTs);
      const prev = getRangeTokenUsageK(ctx.db, prevStart, currentStart);
      if (prev === 0) {
        return null;
      }
      return Math.round(((current - prev) / prev) * 100);
    },
    getTurnCounts: (startTs: string, endTs: string) => {
      const total = getRangeTurnCount(ctx.db, startTs, endTs);
      const bySessionRaw = getRangeTurnCountBySession(ctx.db, startTs, endTs);
      const sessionIdToKey = ctx.sessionReader.getSessionIdToKeyMap();
      const bySession = bySessionRaw.map((r) => ({
        sessionKey: sessionIdToKey.get(r.sessionKey) ?? r.sessionKey,
        turns: r.turns,
      }));
      return { total, bySession };
    },
    getCompanionDays: async () => {
      // Fast path: if DB already has companion_since, skip lifetime scanner entirely
      const cached = getCompanionSince(ctx.db);
      if (cached) {
        return Math.max(1, Math.ceil((Date.now() - new Date(cached).getTime()) / 86_400_000));
      }
      // Cold path: collect all sources including lifetime scanner
      const lifetimeResult = ctx.lifetimeScanner?.getStats();
      const lifetimeCreatedAt = lifetimeResult?.createdAt ?? null;
      const since = await resolveCompanionSince(ctx.db, {
        deviceJsonPath: config.deviceJsonPath,
        openclawDir: config.openclawDir,
        lifetimeCreatedAt,
      });
      if (!since) {
        return 0;
      }
      return Math.max(1, Math.ceil((Date.now() - new Date(since).getTime()) / 86_400_000));
    },
    getTotalConversations: () => {
      return getRangeTurnCount(ctx.db, '1970-01-01T00:00:00Z', new Date().toISOString());
    },
    getRangeMessageCount: (startTs: string, endTs: string) => {
      return getRangeTurnCount(ctx.db, startTs, endTs);
    },
  };
}
