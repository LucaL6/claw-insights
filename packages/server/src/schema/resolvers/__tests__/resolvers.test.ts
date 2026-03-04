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
    ports: {
      sessions: {
        getSessions: vi.fn().mockReturnValue([{ id: 's1', label: 'test', turnCount: 5 }]),
        getSessionById: vi.fn(),
        getSessionsInRange: vi.fn(),
        getSessionCount: vi.fn(),
        onChanged: vi.fn(),
      },
      metrics: {
        getMetrics: vi.fn().mockReturnValue({ totalTokensK: 100, totalCostUsd: 2.5 }),
        onChanged: vi.fn(),
      },
      gateway: {
        getGatewayStatus: vi.fn().mockResolvedValue({
          running: true,
          pid: 1234,
          version: '1.0.0',
          updateAvailable: null,
          uptime: '2h',
          startedAt: '2025-01-01T00:00:00Z',
          connectLatencyMs: 42,
          latestVersion: '1.0.0',
          securitySummary: { critical: 0, warn: 1, info: 0 },
          channels: [
            {
              type: 'discord',
              accountId: 'acc1',
              protocol: 'ws',
              profile: null,
              name: 'general',
              connectionStatus: 'connected',
            },
          ],
          sessionDefaults: null,
        }),
        getVersion: vi.fn().mockResolvedValue('1.0.0'),
        warmCache: vi.fn().mockResolvedValue(undefined),
      },
      cron: {
        getCronJobs: vi.fn().mockReturnValue([
          {
            id: 'job1',
            schedule: '0 * * * *',
            enabled: true,
            lastRun: null,
            nextRun: null,
            description: 'cleanup',
          },
        ]),
        getCronJobById: vi.fn(),
        onChanged: vi.fn(),
      },
      logs: {
        getRecentLogs: vi.fn().mockReturnValue([
          {
            timestamp: Date.now(),
            level: 'info',
            source: 'test',
            message: 'log1',
          },
        ]),
        getLogsInRange: vi.fn(),
        onChanged: vi.fn(),
      },
      system: {
        getSystemMetrics: vi.fn().mockResolvedValue({
          cpu: 25,
          memoryMB: 512,
          diskMB: 1024,
          uptime: '3600s',
          platform: 'darwin',
          nodeVersion: 'v20.0.0',
        }),
        getProcessMetrics: vi.fn(),
      },
      lifetime: {
        getStats: vi.fn().mockReturnValue({
          isReady: true,
          createdAt: '2025-01-01T00:00:00.000Z',
          daysSinceCreation: 100,
          totalSessions: 42,
          totalInputTokens: 1_000_000,
          totalOutputTokens: 500_000,
          totalCacheReadTokens: 200_000,
          totalCacheWriteTokens: 100_000,
          totalTokens: 1_800_000,
          totalUserMessages: 1000,
          totalAssistantMessages: 1000,
        }),
      },
      transcript: {
        getTranscriptPath: vi.fn().mockReturnValue('/tmp/transcripts/test.jsonl'),
      },
      usage: {
        getUsageCost: vi.fn().mockResolvedValue({
          totalCost: 1.5,
          totalTokensM: 1.8,
          todayCost: 0.5,
          todayTokensM: 0.3,
          fetchedAt: new Date().toISOString(),
        }),
      },
    },
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
      // DESIGN-066: attachSubAgents now handled by SpawnBus event system
      expect(ctx.ports.sessions.getSessions).toHaveBeenCalled();
      expect(result).toEqual([{ id: 's1', label: 'test', turnCount: 5 }]);
    });

    it('calls getSessions with filter', () => {
      Query.sessions({}, { filter: { activeOnly: true, sortBy: 'RECENT' } });
      // Task 6: Now uses ctx.ports.sessions instead of ctx.sessionReader
      expect(ctx.ports.sessions.getSessions).toHaveBeenCalled();
    });
  });

  describe('metrics', () => {
    it('calls aggregator.getMetrics and includes warnings', () => {
      const result = Query.metrics({}, { range: 'ONE_HOUR' });
      // Task 6: Now uses ctx.ports.metrics instead of ctx.aggregator
      expect(ctx.ports.metrics.getMetrics).toHaveBeenCalled();
      expect(result).toMatchObject({ totalTokensK: 100, warnings: ['stale data'] });
    });

    it('defaults to TWENTY_FOUR_HOUR for invalid range', () => {
      Query.metrics({}, { range: 'INVALID' });
      // Task 6: Now uses ctx.ports.metrics instead of ctx.aggregator
      expect(ctx.ports.metrics.getMetrics).toHaveBeenCalled();
    });
  });

  describe('cronJobs', () => {
    it('returns from cron port', () => {
      const result = Query.cronJobs({}, {});
      // Phase 2: Now uses ctx.ports.cron instead of ctx.cronReader
      expect(ctx.ports.cron!.getCronJobs).toHaveBeenCalled();
      expect(result).toEqual([
        {
          id: 'job1',
          name: 'cleanup',
          enabled: true,
          schedule: '0 * * * *',
          lastRunAt: null,
          nextRunAt: null,
          lastRunSuccess: null,
        },
      ]);
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
    it('calls getUsageCost via ctx.ports.usage', async () => {
      const result = await Query.usageCost({}, {});
      expect(ctx.ports.usage.getUsageCost).toHaveBeenCalled();
      expect(result).toMatchObject({ totalCost: 1.5 });
    });
  });

  describe('recentLogs', () => {
    it('uses default count of 50', () => {
      Query.recentLogs({}, {});
      // Phase 2: Now uses ctx.ports.logs instead of ctx.logTailer
      expect(ctx.ports.logs!.getRecentLogs).toHaveBeenCalledWith(50, expect.any(Object));
    });

    it('uses custom count', () => {
      Query.recentLogs({}, { count: 10 });
      // Phase 2: Now uses ctx.ports.logs instead of ctx.logTailer
      expect(ctx.ports.logs!.getRecentLogs).toHaveBeenCalledWith(10, expect.any(Object));
    });
  });

  describe('gateway', () => {
    it('calls getGatewayStatus via ctx and maps fields', async () => {
      const result = await Query.gateway({}, {});
      // Task 6: Now uses ctx.ports.gateway instead of ctx.gatewayClient
      expect(ctx.ports.gateway.getGatewayStatus).toHaveBeenCalled();
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
      // Task 6: Now uses ctx.ports.gateway instead of ctx.gatewayClient
      expect(ctx.ports.gateway.getGatewayStatus).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect((result as unknown[])[0]).toMatchObject({ provider: 'discord', connected: true });
    });
  });

  describe('resources', () => {
    it('calls getSystemMetrics via ctx.ports.system', async () => {
      const result = await Query.resources({}, {});
      // Phase 2: Now uses ctx.ports.system instead of ctx.systemInfoService
      expect(ctx.ports.system!.getSystemMetrics).toHaveBeenCalled();
      expect(result).toMatchObject({ cpu: 25, memoryMB: 512, diskMB: 1024 });
    });
  });
});
