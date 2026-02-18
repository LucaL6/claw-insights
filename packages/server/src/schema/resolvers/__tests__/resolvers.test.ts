import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createResolvers } from '../index';
import type { AppContext } from '../../../context';

// Mock external modules used by resolvers
vi.mock('../../../db/event-queries', () => ({
  queryEvents: vi.fn().mockResolvedValue([{ id: 'e1', type: 'error', message: 'boom', ts: '2025-01-01' }]),
  getEventDensity: vi.fn().mockResolvedValue([{ date: '2025-01-01', count: 5 }]),
}));

vi.mock('../../../sources/system-info', () => ({
  getUsageCost: vi.fn().mockResolvedValue({ totalCostUsd: 1.5, breakdown: [] }),
}));

vi.mock('../../../sources/gateway-cli', () => ({
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
}));

function createMockCtx(): AppContext {
  return {
    db: {} as any,
    sessionReader: {
      attachSubAgents: vi.fn(),
      getSessions: vi.fn().mockReturnValue([{ id: 's1', label: 'test' }]),
      destroy: vi.fn(),
    } as any,
    cronReader: {
      getJobs: vi.fn().mockReturnValue([{ name: 'cleanup', schedule: '0 * * * *' }]),
      destroy: vi.fn(),
    } as any,
    systemMetrics: {
      getMetrics: vi.fn().mockResolvedValue({ cpu: 25, memoryMB: 512 }),
    } as any,
    logTailer: {
      getRecentEntries: vi.fn().mockReturnValue([{ message: 'log1' }]),
      destroy: vi.fn(),
      on: vi.fn(),
    } as any,
    spawnTracker: {
      getParentChildMap: vi.fn().mockReturnValue(new Map()),
      ingest: vi.fn(),
    } as any,
    aggregator: {
      getMetrics: vi.fn().mockReturnValue({ totalTokensK: 100, totalCostUsd: 2.5 }),
      ingestLog: vi.fn(),
    } as any,
    metricsCollector: { start: vi.fn(), stop: vi.fn() } as any,
    dataValidator: {
      runValidation: vi.fn().mockReturnValue([
        { pass: true, message: 'ok' },
        { pass: false, message: 'stale data' },
      ]),
      start: vi.fn(),
      stop: vi.fn(),
    } as any,
    dataRetention: { start: vi.fn(), stop: vi.fn() } as any,
  };
}

describe('createResolvers', () => {
  let ctx: AppContext;
  let resolvers: any;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockCtx();
    resolvers = createResolvers(ctx);
  });

  describe('sessions', () => {
    it('calls getSessions without filter', () => {
      const result = resolvers.Query.sessions({}, {});
      expect(ctx.sessionReader.attachSubAgents).toHaveBeenCalled();
      expect(ctx.sessionReader.getSessions).toHaveBeenCalledWith(undefined);
      expect(result).toEqual([{ id: 's1', label: 'test' }]);
    });

    it('calls getSessions with filter', () => {
      resolvers.Query.sessions({}, { filter: { activeOnly: true, sortBy: 'RECENT' } });
      expect(ctx.sessionReader.getSessions).toHaveBeenCalledWith({ activeOnly: true, sortBy: 'RECENT' });
    });
  });

  describe('metrics', () => {
    it('calls aggregator.getMetrics and includes warnings', () => {
      const result = resolvers.Query.metrics({}, { range: 'ONE_HOUR' });
      expect(ctx.aggregator.getMetrics).toHaveBeenCalledWith(undefined, 'ONE_HOUR');
      expect(result).toMatchObject({ totalTokensK: 100, warnings: ['stale data'] });
    });

    it('defaults to TWENTY_FOUR_HOUR for invalid range', () => {
      resolvers.Query.metrics({}, { range: 'INVALID' });
      expect(ctx.aggregator.getMetrics).toHaveBeenCalledWith(undefined, 'TWENTY_FOUR_HOUR');
    });
  });

  describe('cronJobs', () => {
    it('returns from cronReader', () => {
      const result = resolvers.Query.cronJobs({}, {});
      expect(ctx.cronReader.getJobs).toHaveBeenCalled();
      expect(result).toEqual([{ name: 'cleanup', schedule: '0 * * * *' }]);
    });
  });

  describe('events', () => {
    it('calls queryEvents with args', async () => {
      const { queryEvents } = await import('../../../db/event-queries');
      const result = await resolvers.Query.events({}, { from: '2025-01-01', to: '2025-01-02', types: ['error'], limit: 10 });
      expect(queryEvents).toHaveBeenCalledWith(ctx.db, { from: '2025-01-01', to: '2025-01-02', types: ['error'], limit: 10 });
      expect(result).toHaveLength(1);
    });
  });

  describe('eventDensity', () => {
    it('calls getEventDensity', async () => {
      const result = await resolvers.Query.eventDensity({}, {});
      expect(result).toEqual([{ date: '2025-01-01', count: 5 }]);
    });
  });

  describe('usageCost', () => {
    it('calls getUsageCost', async () => {
      const result = await resolvers.Query.usageCost({}, {});
      expect(result).toMatchObject({ totalCostUsd: 1.5 });
    });
  });

  describe('recentLogs', () => {
    it('uses default count of 50', () => {
      resolvers.Query.recentLogs({}, {});
      expect(ctx.logTailer.getRecentEntries).toHaveBeenCalledWith(50);
    });

    it('uses custom count', () => {
      resolvers.Query.recentLogs({}, { count: 10 });
      expect(ctx.logTailer.getRecentEntries).toHaveBeenCalledWith(10);
    });
  });

  describe('gateway', () => {
    it('calls getGatewayStatus and maps fields', async () => {
      const result = await resolvers.Query.gateway({}, {});
      expect(result).toMatchObject({ running: true, pid: 1234, version: '1.0.0', securityCritical: 0, securityWarn: 1 });
    });
  });

  describe('channels', () => {
    it('returns status.channels', async () => {
      const result = await resolvers.Query.channels({}, {});
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ provider: 'DISCORD', connected: true });
    });
  });

  describe('resources', () => {
    it('calls systemMetrics.getMetrics', async () => {
      const result = await resolvers.Query.resources({}, {});
      expect(ctx.systemMetrics.getMetrics).toHaveBeenCalled();
      expect(result).toMatchObject({ cpu: 25, memoryMB: 512 });
    });
  });
});
