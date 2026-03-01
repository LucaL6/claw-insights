import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context';
import { createResolvers } from '../index';

// Mock external modules used by resolvers
vi.mock('../../../db/event-queries', () => ({
  queryEvents: vi.fn().mockResolvedValue([{ id: 'e1', type: 'error', message: 'boom', ts: '2025-01-01' }]),
  getEventDensity: vi.fn().mockResolvedValue([{ date: '2025-01-01', count: 5 }]),
}));

vi.mock('../../../sources/system-info', () => ({
  createSystemInfoService: vi.fn(),
}));

vi.mock('../../../sources/gateway-cli', () => ({
  createGatewayClient: vi.fn(),
}));

function createMockCtx(): AppContext {
  return {
    db: {},
    pipeline: {},
    sessionReader: {
      attachSubAgents: vi.fn(),
      getSessions: vi.fn().mockReturnValue([{ id: 's1', label: 'test', turnCount: 5 }]),
      destroy: vi.fn(),
    },
    cronReader: {
      getJobs: vi.fn().mockReturnValue([{ name: 'cleanup', schedule: '0 * * * *' }]),
      destroy: vi.fn(),
    },
    logTailer: {
      getRecentEntries: vi.fn().mockReturnValue([{ message: 'log1' }]),
      destroy: vi.fn(),
      on: vi.fn(),
    },
    spawnTracker: {
      getParentChildMap: vi.fn().mockReturnValue(new Map()),
      ingest: vi.fn(),
    },
    aggregator: {
      getMetrics: vi.fn().mockReturnValue({ totalTokensK: 100, totalCostUsd: 2.5 }),
      ingestLog: vi.fn(),
    },
    metricsCollector: { start: vi.fn(), stop: vi.fn() },
    gatewayClient: {
      getGatewayStatus: vi.fn().mockResolvedValue({
        running: true,
        pid: 1234,
        version: '1.0.0',
        updateAvailable: false,
        uptime: '2h',
        startedAt: '2025-01-01T00:00:00Z',
        connectLatencyMs: 42,
        latestVersion: '1.0.0',
        securitySummary: { critical: 0, warn: 1 },
        channels: [{ provider: 'DISCORD', name: 'general', connected: true, latencyMs: 10 }],
      }),
      getVersion: vi.fn().mockResolvedValue('1.0.0'),
      warmCache: vi.fn().mockResolvedValue(undefined),
    },
    systemInfoService: {
      getSystemMetrics: vi.fn().mockResolvedValue({ cpu: 25, memoryMB: 512 }),
      getUsageCost: vi.fn().mockResolvedValue({ totalCostUsd: 1.5, breakdown: [] }),
      resetMetricsCache: vi.fn(),
      resetCostCache: vi.fn(),
    },
    dataValidator: {
      runValidation: vi.fn().mockReturnValue([
        { pass: true, message: 'ok' },
        { pass: false, message: 'stale data' },
      ]),
      start: vi.fn(),
      stop: vi.fn(),
    },
    dataRetention: { start: vi.fn(), stop: vi.fn() },
  } as unknown as AppContext;
}

// Helper: Query resolvers with all fields required and callable
type QueryFns = Required<{
  [K in keyof NonNullable<ReturnType<typeof createResolvers>['Query']>]: (...args: any[]) => unknown;
}>;

describe('createResolvers', () => {
  let ctx: AppContext;
  let resolvers: ReturnType<typeof createResolvers>;
  let Query: QueryFns;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockCtx();
    resolvers = createResolvers(ctx);
    Query = resolvers.Query! as unknown as QueryFns;
  });

  describe('sessions', () => {
    it('calls getSessions without filter', () => {
      const result = Query.sessions({}, {});
      expect(ctx.sessionReader.attachSubAgents).toHaveBeenCalled();
      expect(ctx.sessionReader.getSessions).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([{ id: 's1', label: 'test', turnCount: 5 }]);
    });

    it('calls getSessions with filter', () => {
      Query.sessions({}, { filter: { activeOnly: true, sortBy: 'RECENT' } });
      expect(ctx.sessionReader.getSessions).toHaveBeenCalledWith({ activeOnly: true, sortBy: 'RECENT' });
    });
  });

  describe('metrics', () => {
    it('calls aggregator.getMetrics and includes warnings', () => {
      const result = Query.metrics({}, { range: 'ONE_HOUR' });
      expect(ctx.aggregator.getMetrics).toHaveBeenCalledWith(undefined, 'ONE_HOUR');
      expect(result).toMatchObject({ totalTokensK: 100, warnings: ['stale data'] });
    });

    it('defaults to TWENTY_FOUR_HOUR for invalid range', () => {
      Query.metrics({}, { range: 'INVALID' });
      expect(ctx.aggregator.getMetrics).toHaveBeenCalledWith(undefined, 'TWENTY_FOUR_HOUR');
    });
  });

  describe('cronJobs', () => {
    it('returns from cronReader', () => {
      const result = Query.cronJobs({}, {});
      expect(ctx.cronReader.getJobs).toHaveBeenCalled();
      expect(result).toEqual([{ name: 'cleanup', schedule: '0 * * * *' }]);
    });
  });

  describe('events', () => {
    it('calls queryEvents with args', async () => {
      const { queryEvents } = await import('../../../db/event-queries');
      const result = await Query.events({}, { from: '2025-01-01', to: '2025-01-02', types: ['error'], limit: 10 });
      expect(queryEvents).toHaveBeenCalledWith(ctx.db, {
        from: '2025-01-01',
        to: '2025-01-02',
        types: ['error'],
        limit: 10,
      });
      expect(result).toHaveLength(1);
    });
  });

  describe('eventDensity', () => {
    it('calls getEventDensity', async () => {
      const result = await Query.eventDensity({}, {});
      expect(result).toEqual([{ date: '2025-01-01', count: 5 }]);
    });
  });

  describe('usageCost', () => {
    it('calls getUsageCost via ctx', async () => {
      const result = await Query.usageCost({}, {});
      expect(ctx.systemInfoService.getUsageCost).toHaveBeenCalled();
      expect(result).toMatchObject({ totalCostUsd: 1.5 });
    });
  });

  describe('recentLogs', () => {
    it('uses default count of 50', () => {
      Query.recentLogs({}, {});
      expect(ctx.logTailer.getRecentEntries).toHaveBeenCalledWith(50);
    });

    it('uses custom count', () => {
      Query.recentLogs({}, { count: 10 });
      expect(ctx.logTailer.getRecentEntries).toHaveBeenCalledWith(10);
    });
  });

  describe('gateway', () => {
    it('calls getGatewayStatus via ctx and maps fields', async () => {
      const result = await Query.gateway({}, {});
      expect(ctx.gatewayClient.getGatewayStatus).toHaveBeenCalled();
      expect(result).toMatchObject({
        running: true,
        pid: 1234,
        version: '1.0.0',
        securityCritical: 0,
        securityWarn: 1,
      });
    });
  });

  describe('channels', () => {
    it('returns status.channels via ctx', async () => {
      const result = await Query.channels({}, {});
      expect(ctx.gatewayClient.getGatewayStatus).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect((result as unknown[])[0]).toMatchObject({ provider: 'DISCORD', connected: true });
    });
  });

  describe('resources', () => {
    it('calls getSystemMetrics via ctx', async () => {
      const result = await Query.resources({}, {});
      expect(ctx.systemInfoService.getSystemMetrics).toHaveBeenCalled();
      expect(result).toMatchObject({ cpu: 25, memoryMB: 512 });
    });
  });
});
