import type { AppContext } from '../context.js';
import { queryEvents } from '../db/event-queries.js';
import { getRangeTurnCount, getRangeTurnCountBySession } from '../db/message-queries.js';
import { type MetricsRangeKey, RANGE_CONFIG } from '../db/query-utils.js';
import { getRangeModelTokenUsage, getRangeTokenUsageK } from '../db/token-queries.js';
import { getGatewayStatus } from '../sources/gateway-cli.js';
import { getSystemMetrics } from '../sources/system-info.js';
import type { DataSources } from './snapshot-types.js';

const VALID_RANGES = new Set<MetricsRangeKey>(Object.keys(RANGE_CONFIG) as MetricsRangeKey[]);

export function createSnapshotSources(ctx: AppContext): DataSources {
  return {
    getGateway: async () => {
      const s = await getGatewayStatus();
      const sys = await getSystemMetrics();
      return { ...s, cpu: sys.cpu, memoryMB: sys.memoryMB };
    },
    getChannels: async () => (await getGatewayStatus()).channels,
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
  };
}
