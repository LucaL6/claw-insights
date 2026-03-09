import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context';
import { createResolvers } from '../index';

// Mock external modules used by resolvers
vi.mock('../../../db/event-queries', () => ({
  queryEvents: vi.fn().mockResolvedValue([{ id: 'e1', type: 'error', message: 'boom', ts: '2025-01-01' }]),
  getEventDensity: vi.fn().mockResolvedValue([{ date: '2025-01-01', count: 5 }]),
  getEventCounts: vi.fn().mockResolvedValue({ error: 0, warning: 0, restart: 0 }),
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
              provider: 'discord',
              name: 'general',
              connected: true,
              latencyMs: null,
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

describe('createResolvers (canonical)', () => {
  let ctx: AppContext;
  let resolvers: ReturnType<typeof createResolvers>;
  let Query: QueryFns;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = createMockCtx();
    resolvers = createResolvers(ctx);
    Query = resolvers.Query! as unknown as QueryFns;
  });

  describe('Query.system', () => {
    it('returns OpenClawSystem root', () => {
      const result = Query.system({}, { context: null }, {}) as Record<string, unknown>;
      expect(result._kind).toBe('OpenClawSystem');
    });
  });

  describe('Query.sources', () => {
    it('lists registered sources', () => {
      const result = Query.sources({}, { filter: null, context: null }) as unknown[];
      expect(result.length).toBeGreaterThanOrEqual(1);
    });

    it('filters by category', () => {
      const agents = Query.sources({}, { filter: { category: 'AGENT' }, context: null }) as unknown[];
      expect(agents.length).toBe(1);
      const dashboards = Query.sources({}, { filter: { category: 'DASHBOARD' }, context: null }) as unknown[];
      expect(dashboards.length).toBe(1);
    });
  });

  describe('Query.source', () => {
    it('resolves agent by id', () => {
      const result = Query.source({}, { selector: { id: 'agent:main' }, context: null }, {}) as Record<string, unknown>;
      expect(result).not.toBeNull();
      expect(result._agent).toBeDefined();
    });

    it('resolves dashboard by id', () => {
      const result = Query.source({}, { selector: { id: 'dashboard:main' }, context: null }, {}) as Record<
        string,
        unknown
      >;
      expect(result).not.toBeNull();
      expect(result._info).toBeDefined();
    });

    it('returns null for unknown source', () => {
      const result = Query.source({}, { selector: { id: 'unknown:foo' }, context: null }, {});
      expect(result).toBeNull();
    });
  });

  describe('SourceNamespace.__resolveType', () => {
    it('resolves AgentNamespace', () => {
      const resolveType = (resolvers as any).SourceNamespace.__resolveType;
      expect(resolveType({ _agent: {} })).toBe('AgentNamespace');
    });

    it('resolves DashboardNamespace', () => {
      const resolveType = (resolvers as any).SourceNamespace.__resolveType;
      expect(resolveType({ _info: {} })).toBe('DashboardNamespace');
    });

    it('returns null for unknown', () => {
      const resolveType = (resolvers as any).SourceNamespace.__resolveType;
      expect(resolveType({})).toBeNull();
    });
  });
});
