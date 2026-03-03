/**
 * Branch coverage tests for resolver slow-logging paths, error paths, and arg defaults.
 */
import { describe, expect, it, vi } from 'vitest';

// ── logger mock (captures debug calls for slow-path verification) ──
const { mockDebug } = vi.hoisted(() => ({ mockDebug: vi.fn() }));
vi.mock('../../../logger.js', () => ({
  createChildLogger: () => ({ debug: mockDebug, error: vi.fn(), info: vi.fn(), warn: vi.fn() }),
}));

// ── event-queries mock ──
const { mockQueryEvents, mockGetEventDensity, mockGetEventCounts } = vi.hoisted(() => ({
  mockQueryEvents: vi.fn().mockReturnValue([]),
  mockGetEventDensity: vi.fn().mockReturnValue([]),
  mockGetEventCounts: vi.fn().mockReturnValue({}),
}));
vi.mock('../../../db/event-queries', () => ({
  queryEvents: mockQueryEvents,
  getEventDensity: mockGetEventDensity,
  getEventCounts: mockGetEventCounts,
}));

import type { AppContext } from '../../../context.js';
import { cronResolvers } from '../cron.resolver.js';
import { eventsResolvers } from '../events.resolver.js';
import { gatewayResolvers } from '../gateway.resolver.js';
import { lifetimeResolvers } from '../lifetime.resolver.js';
import { metricsResolvers } from '../metrics.resolver.js';
import { usageResolvers } from '../usage.resolver.js';

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Minimal AppContext mock — only typed properties used by resolvers */
interface MockCtxOverrides {
  gatewayClient?: { getGatewayStatus: ReturnType<typeof vi.fn> };
  systemInfoService?: { getSystemMetrics: ReturnType<typeof vi.fn>; getUsageCost: ReturnType<typeof vi.fn> };
  cronReader?: { getJobs: ReturnType<typeof vi.fn> };
  lifetimeScanner?: { getStats: ReturnType<typeof vi.fn> };
  logTailer?: { getRecentEntries: ReturnType<typeof vi.fn> };
  aggregator?: { getMetrics: ReturnType<typeof vi.fn> };
  dataValidator?: { runValidation: ReturnType<typeof vi.fn> };
  db?: unknown;
}

function mockCtx(overrides: MockCtxOverrides = {}): AppContext {
  const base: MockCtxOverrides = {
    ports: {
      sessions: {
        getSessions: vi.fn().mockReturnValue([]),
        getSessionById: vi.fn(),
        getSessionsInRange: vi.fn(),
        getSessionCount: vi.fn(),
        onChanged: vi.fn(() => () => {}),
      },
      metrics: {
        getMetrics: vi.fn().mockReturnValue({}),
        getSessionTokens: vi.fn(),
        clearCache: vi.fn(),
        onChanged: vi.fn(() => () => {}),
      },
      gateway: {
        getGatewayStatus: vi.fn().mockResolvedValue({
          running: true,
          pid: 1,
          version: '1.0',
          updateAvailable: null,
          uptime: '100s',
          startedAt: '2025-01-01',
          connectLatencyMs: 5,
          latestVersion: '1.0',
          securitySummary: { critical: 0, warn: 0, info: 0 },
          channels: [],
          sessionDefaults: null,
        }),
        getVersion: vi.fn().mockResolvedValue('1.0'),
        warmCache: vi.fn().mockResolvedValue(undefined),
      },
      cron: undefined,
      logs: undefined,
      system: undefined,
    },
    gatewayClient: {
      getGatewayStatus: vi.fn().mockResolvedValue({
        running: true,
        pid: 1,
        version: '1.0',
        updateAvailable: false,
        uptime: 100,
        startedAt: '2025-01-01',
        connectLatencyMs: 5,
        latestVersion: '1.0',
        securitySummary: { critical: 0, warn: 0 },
        channels: [],
      }),
    },
    systemInfoService: {
      getSystemMetrics: vi.fn().mockResolvedValue({ cpu: 0, memoryMB: 0 }),
      getUsageCost: vi.fn().mockResolvedValue({ totalCost: 0 }),
    },
    sessionReader: {
      attachSubAgents: vi.fn(),
      getSessions: vi.fn().mockReturnValue([]),
    },
    spawnTracker: {
      getParentChildMap: vi.fn().mockReturnValue(new Map()),
    },
    cronReader: { getJobs: vi.fn().mockReturnValue([]) },
    lifetimeScanner: { getStats: vi.fn().mockResolvedValue({}) },
    logTailer: { getRecentEntries: vi.fn().mockReturnValue([]) },
    aggregator: { getMetrics: vi.fn().mockReturnValue({}) },
    dataValidator: { runValidation: vi.fn().mockReturnValue([]) },
    db: {},
  };
  return { ...base, ...overrides } as unknown as AppContext;
}

// ── Slow-path tests (ms > 100) ──

describe('slow resolve branches', () => {
  it('cron: logs when slow', () => {
    mockDebug.mockClear();
    const ctx = mockCtx({
      cronReader: {
        getJobs: vi.fn().mockImplementation(() => {
          const end = performance.now() + 110;
          while (performance.now() < end) {
            /* busy-wait */
          }
          return [];
        }),
      },
    });
    const r = cronResolvers(ctx);
    const result = (r.Query!.cronJobs as Function)();
    expect(result).toEqual([]);
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({ ms: expect.any(Number) }),
      expect.stringContaining('slow resolve'),
    );
  });

  it('lifetime: logs when slow', async () => {
    mockDebug.mockClear();
    const ctx = mockCtx({
      lifetimeScanner: {
        getStats: vi.fn().mockImplementation(() => delay(110).then(() => ({}))),
      },
    });
    const r = lifetimeResolvers(ctx);
    const result = await (r.Query!.lifetimeStats as Function)();
    expect(result).toEqual({});
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({ ms: expect.any(Number) }),
      expect.stringContaining('slow resolve'),
    );
  });

  it('gateway: logs when slow', async () => {
    mockDebug.mockClear();
    const slowStatus = {
      running: true,
      pid: 1,
      version: '1.0',
      updateAvailable: null,
      uptime: '100s',
      startedAt: '2025-01-01',
      connectLatencyMs: 5,
      latestVersion: '1.0',
      securitySummary: { critical: 0, warn: 0, info: 0 },
      channels: [],
      sessionDefaults: null,
    };
    const ctx = mockCtx({
      ports: {
        sessions: mockCtx().ports.sessions,
        metrics: mockCtx().ports.metrics,
        gateway: {
          getGatewayStatus: vi.fn().mockImplementation(() => delay(110).then(() => slowStatus)),
          getVersion: vi.fn(),
          warmCache: vi.fn(),
        },
        cron: undefined,
        logs: undefined,
        system: undefined,
      },
    });
    const r = gatewayResolvers(ctx);
    const gw = await (r.Query!.gateway as Function)();
    expect(gw).toHaveProperty('running', true);
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({ ms: expect.any(Number) }),
      expect.stringContaining('slow resolve'),
    );
  });

  it('channels: logs when slow', async () => {
    mockDebug.mockClear();
    const ctx = mockCtx({
      ports: {
        sessions: mockCtx().ports.sessions,
        metrics: mockCtx().ports.metrics,
        gateway: {
          getGatewayStatus: vi.fn().mockImplementation(() =>
            delay(110).then(() => ({
              running: true,
              pid: 1,
              version: '1.0',
              updateAvailable: null,
              uptime: '100s',
              startedAt: '2025-01-01',
              connectLatencyMs: 5,
              latestVersion: '1.0',
              securitySummary: { critical: 0, warn: 0, info: 0 },
              channels: [],
              sessionDefaults: null,
            })),
          ),
          getVersion: vi.fn(),
          warmCache: vi.fn(),
        },
        cron: undefined,
        logs: undefined,
        system: undefined,
      },
    });
    const r = gatewayResolvers(ctx);
    const result = await (r.Query!.channels as Function)();
    expect(result).toEqual([]);
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({ ms: expect.any(Number) }),
      expect.stringContaining('slow resolve'),
    );
  });

  it('resources: logs when slow', async () => {
    mockDebug.mockClear();
    const ctx = mockCtx({
      systemInfoService: {
        getSystemMetrics: vi.fn().mockImplementation(() => delay(110).then(() => ({ cpu: 0 }))),
        getUsageCost: vi.fn().mockResolvedValue({}),
      },
    });
    const r = gatewayResolvers(ctx);
    const result = await (r.Query!.resources as Function)();
    expect(result).toEqual({ cpu: 0 });
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({ ms: expect.any(Number) }),
      expect.stringContaining('slow resolve'),
    );
  });

  it('usageCost: logs when slow', async () => {
    mockDebug.mockClear();
    const ctx = mockCtx({
      systemInfoService: {
        getSystemMetrics: vi.fn(),
        getUsageCost: vi.fn().mockImplementation(() => delay(110).then(() => ({ totalCost: 0 }))),
      },
    });
    const r = usageResolvers(ctx);
    const result = await (r.Query!.usageCost as Function)();
    expect(result).toEqual({ totalCost: 0 });
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({ ms: expect.any(Number) }),
      expect.stringContaining('slow resolve'),
    );
  });

  it('recentLogs: logs when slow', () => {
    mockDebug.mockClear();
    const ctx = mockCtx({
      logTailer: {
        getRecentEntries: vi.fn().mockImplementation(() => {
          const end = performance.now() + 110;
          while (performance.now() < end) {
            /* busy-wait */
          }
          return [];
        }),
      },
    });
    const r = usageResolvers(ctx);
    const result = (r.Query!.recentLogs as Function)({}, { count: 10 });
    expect(result).toEqual([]);
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({ ms: expect.any(Number) }),
      expect.stringContaining('slow resolve'),
    );
  });

  it('metrics: logs when slow', () => {
    mockDebug.mockClear();
    const ctx = mockCtx({
      ports: {
        sessions: mockCtx().ports.sessions,
        metrics: {
          getMetrics: vi.fn().mockImplementation(() => {
            const end = performance.now() + 110;
            while (performance.now() < end) {
              /* busy-wait */
            }
            return {};
          }),
          getSessionTokens: vi.fn(),
          clearCache: vi.fn(),
          onChanged: vi.fn(() => () => {}),
        },
        gateway: mockCtx().ports.gateway,
        cron: undefined,
        logs: undefined,
        system: undefined,
      },
    });
    const r = metricsResolvers(ctx);
    const result = (r.Query!.metrics as Function)({}, { range: 'ONE_HOUR' });
    expect(result).toHaveProperty('warnings');
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({ ms: expect.any(Number) }),
      expect.stringContaining('slow resolve'),
    );
  });

  it('events: logs when slow', async () => {
    mockDebug.mockClear();
    mockQueryEvents.mockImplementation(() => {
      const end = performance.now() + 110;
      while (performance.now() < end) {
        /* busy-wait */
      }
      return [];
    });
    const ctx = mockCtx();
    const r = eventsResolvers(ctx);
    const result = await (r.Query!.events as Function)({}, {});
    expect(result).toEqual([]);
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({ ms: expect.any(Number) }),
      expect.stringContaining('slow resolve'),
    );
    mockQueryEvents.mockReturnValue([]);
  });

  it('eventDensity: logs when slow', async () => {
    mockDebug.mockClear();
    mockGetEventDensity.mockImplementation(() => {
      const end = performance.now() + 110;
      while (performance.now() < end) {
        /* busy-wait */
      }
      return [];
    });
    const ctx = mockCtx();
    const r = eventsResolvers(ctx);
    const result = await (r.Query!.eventDensity as Function)();
    expect(result).toEqual([]);
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({ ms: expect.any(Number) }),
      expect.stringContaining('slow resolve'),
    );
    mockGetEventDensity.mockReturnValue([]);
  });

  it('eventCounts: logs when slow', async () => {
    mockDebug.mockClear();
    mockGetEventCounts.mockImplementation(() => {
      const end = performance.now() + 110;
      while (performance.now() < end) {
        /* busy-wait */
      }
      return {};
    });
    const ctx = mockCtx();
    const r = eventsResolvers(ctx);
    const result = await (r.Query!.eventCounts as Function)({}, {});
    expect(result).toEqual({});
    expect(mockDebug).toHaveBeenCalledWith(
      expect.objectContaining({ ms: expect.any(Number) }),
      expect.stringContaining('slow resolve'),
    );
    mockGetEventCounts.mockReturnValue({});
  });
});

// ── Error paths (safe() catch) ──

describe('safe() error paths', () => {
  it('lifetime: rejects → GraphQLError', async () => {
    const ctx = mockCtx({
      lifetimeScanner: { getStats: vi.fn().mockRejectedValue(new Error('boom')) },
    });
    const r = lifetimeResolvers(ctx);
    await expect((r.Query!.lifetimeStats as Function)()).rejects.toThrow('boom');
  });

  it('events: rejects → GraphQLError', async () => {
    mockQueryEvents.mockImplementation(() => {
      throw new Error('db fail');
    });
    const ctx = mockCtx();
    const r = eventsResolvers(ctx);
    await expect((r.Query!.events as Function)({}, {})).rejects.toThrow('db fail');
    mockQueryEvents.mockReturnValue([]);
  });
});

// ── Args coalescing ──

describe('args defaults / coalescing', () => {
  it('recentLogs: null count defaults to 50', () => {
    const getRecentEntries = vi.fn().mockReturnValue([]);
    const ctx = mockCtx({ logTailer: { getRecentEntries } });
    const r = usageResolvers(ctx);
    (r.Query!.recentLogs as Function)({}, { count: null });
    expect(getRecentEntries).toHaveBeenCalledWith(50);
  });

  it('recentLogs: undefined count defaults to 50', () => {
    const getRecentEntries = vi.fn().mockReturnValue([]);
    const ctx = mockCtx({ logTailer: { getRecentEntries } });
    const r = usageResolvers(ctx);
    (r.Query!.recentLogs as Function)({}, {});
    expect(getRecentEntries).toHaveBeenCalledWith(50);
  });

  it('metrics: invalid range falls back to TWENTY_FOUR_HOUR', () => {
    const getMetrics = vi.fn().mockReturnValue({});
    const ctx = mockCtx({
      ports: {
        sessions: mockCtx().ports.sessions,
        metrics: { ...mockCtx().ports.metrics, getMetrics },
        gateway: mockCtx().ports.gateway,
        cron: undefined,
        logs: undefined,
        system: undefined,
      },
      dataValidator: { runValidation: vi.fn().mockReturnValue([]) },
    });
    const r = metricsResolvers(ctx);
    (r.Query!.metrics as Function)({}, { range: 'INVALID' });
    expect(getMetrics).toHaveBeenCalledWith(undefined, 'TWENTY_FOUR_HOUR', expect.anything());
  });

  it('metrics: null args.range falls back to TWENTY_FOUR_HOUR', () => {
    const getMetrics = vi.fn().mockReturnValue({});
    const ctx = mockCtx({
      ports: {
        sessions: mockCtx().ports.sessions,
        metrics: { ...mockCtx().ports.metrics, getMetrics },
        gateway: mockCtx().ports.gateway,
        cron: undefined,
        logs: undefined,
        system: undefined,
      },
      dataValidator: { runValidation: vi.fn().mockReturnValue([]) },
    });
    const r = metricsResolvers(ctx);
    (r.Query!.metrics as Function)({}, {});
    expect(getMetrics).toHaveBeenCalledWith(undefined, 'TWENTY_FOUR_HOUR', expect.anything());
  });

  it('events: null args coalesce to undefined', async () => {
    mockQueryEvents.mockReturnValue([]);
    const ctx = mockCtx();
    const r = eventsResolvers(ctx);
    await (r.Query!.events as Function)({}, { from: null, to: null, types: null, limit: null });
    expect(mockQueryEvents).toHaveBeenCalledWith(ctx.db, {
      from: undefined,
      to: undefined,
      types: undefined,
      limit: undefined,
    });
  });
});
