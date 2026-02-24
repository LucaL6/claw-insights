import type { Express } from 'express';

import type { AppContext } from '../context.js';
import { queryEvents } from '../db/event-queries.js';
import type { MetricsRangeKey } from '../db/query-utils.js';
import { authMiddleware } from '../middleware/auth.js';
import type { DataSources } from '../services/snapshot-types.js';
import { getGatewayStatus } from '../sources/gateway-cli.js';
import { getSystemMetrics } from '../sources/system-info.js';
import { createSnapshotHandler } from './snapshot-handler.js';

export function registerSnapshot(app: Express, ctx: AppContext): void {
  const sources: DataSources = {
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
      const VALID_RANGES = new Set(['ONE_HOUR', 'SIX_HOUR', 'TWELVE_HOUR', 'TWENTY_FOUR_HOUR']);
      const validated: MetricsRangeKey = VALID_RANGES.has(range) ? range as MetricsRangeKey : 'TWENTY_FOUR_HOUR';
      return ctx.aggregator.getMetrics(undefined, validated) as ReturnType<DataSources['getMetrics']>;
    },
    getRecentErrors: (limit: number) => queryEvents(ctx.db, { types: ['error', 'warning'], limit }),
  };

  app.post('/api/snapshot', authMiddleware, createSnapshotHandler(sources));
}
