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
  return {
    getGateway: async () => {
      log.debug('collecting gateway data');
      try {
        const s = await ctx.gatewayClient.getGatewayStatus();
        const sys = await ctx.systemInfoService.getSystemMetrics();
        log.debug('gateway data collected');
        return { ...s, cpu: sys.cpu, memoryMB: sys.memoryMB };
      } catch (err) {
        log.warn({ err }, 'failed to collect gateway data');
        throw err;
      }
    },
    getChannels: async () => (await ctx.gatewayClient.getGatewayStatus()).channels,
    getSessions: () => {
      ctx.sessionReader.attachSubAgents(ctx.spawnTracker.getParentChildMap());
      return ctx.sessionReader.getSessions();
    },
    getMetrics: (range: string) => {
      const validated: MetricsRangeKey = VALID_RANGES.has(range as MetricsRangeKey)
        ? (range as MetricsRangeKey)
        : 'TWENTY_FOUR_HOUR';
      return ctx.aggregator.getMetrics(undefined, validated) as ReturnType<DataSources['getMetrics']>;
    },
    getRecentErrors: (limit: number) => queryEvents(ctx.db, { types: ['error', 'warning'], limit }),
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
      const lifetimeResult = await ctx.lifetimeScanner?.getStats();
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
