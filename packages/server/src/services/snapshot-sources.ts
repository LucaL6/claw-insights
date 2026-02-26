import type { AppContext } from '../context.js';
import { queryEvents } from '../db/event-queries.js';
import type { MetricsRangeKey } from '../db/query-utils.js';
import { getGatewayStatus } from '../sources/gateway-cli.js';
import { getSystemMetrics } from '../sources/system-info.js';
import type { DataSources } from './snapshot-types.js';

const VALID_RANGES = new Set(['ONE_HOUR', 'SIX_HOUR', 'TWELVE_HOUR', 'TWENTY_FOUR_HOUR']);

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
      const validated: MetricsRangeKey = VALID_RANGES.has(range) ? (range as MetricsRangeKey) : 'TWENTY_FOUR_HOUR';
      return ctx.aggregator.getMetrics(undefined, validated) as ReturnType<DataSources['getMetrics']>;
    },
    getRecentErrors: (limit: number) => queryEvents(ctx.db, { types: ['error', 'warning'], limit }),
  };
}
