import { describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context.js';

// ── Mocks ──

vi.mock('../../../sources/gateway-cli', () => ({
  createGatewayClient: vi.fn(),
}));

vi.mock('../../../sources/system-info', () => ({
  createSystemInfoService: vi.fn(),
}));

vi.mock('../../../config', () => ({
  config: { cliPath: '/usr/bin/echo' },
  CLI_ENV: {},
}));

vi.mock('../../../logger', () => ({
  createChildLogger: () => ({ info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }),
}));

function mockCtx(): AppContext {
  return {
    db: {},
    pipeline: {},
    ports: {
      sessions: {
        getSessions: vi.fn().mockReturnValue([]),
        getSessionById: vi.fn(),
        getSessionsInRange: vi.fn(),
        getSessionCount: vi.fn(),
        onChanged: vi.fn(),
      },
      metrics: {
        getMetrics: vi.fn(),
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
      cron: {} as any,
      logs: {} as any,
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
    },
    sessionReader: {
      attachSubAgents: vi.fn(),
      getSessions: vi.fn().mockReturnValue([]),
      destroy: vi.fn(),
    },
    cronReader: { getJobs: vi.fn(), destroy: vi.fn() },
    logTailer: { getRecentEntries: vi.fn(), destroy: vi.fn(), on: vi.fn() },
    spawnTracker: { getParentChildMap: vi.fn().mockReturnValue(new Map()), ingest: vi.fn() },
    aggregator: { getMetrics: vi.fn(), ingestLog: vi.fn() },
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
    dataValidator: { runValidation: vi.fn().mockReturnValue([]), start: vi.fn(), stop: vi.fn() },
    dataRetention: { start: vi.fn(), stop: vi.fn() },
  } as unknown as AppContext;
}

// ── Sessions resolver branches ──

describe('sessionsResolvers branches', () => {
  it('passes filter with null activeOnly/sortBy as undefined', async () => {
    const { sessionsResolvers } = await import('../sessions.resolver.js');
    const ctx = mockCtx();
    const resolvers = sessionsResolvers(ctx);
    const sessions = resolvers.Query!.sessions!;

    // filter provided but fields are null → should convert to undefined
    (sessions as Function)({}, { filter: { activeOnly: null, sortBy: null } });
    // Task 6: Now uses ctx.ports.sessions
    expect(ctx.ports.sessions.getSessions).toHaveBeenCalled();
  });

  it('passes filter with actual values', async () => {
    const { sessionsResolvers } = await import('../sessions.resolver.js');
    const ctx = mockCtx();
    const resolvers = sessionsResolvers(ctx);
    const sessions = resolvers.Query!.sessions!;

    (sessions as Function)({}, { filter: { activeOnly: true, sortBy: 'RECENT' } });
    // Task 6: Now uses ctx.ports.sessions
    expect(ctx.ports.sessions.getSessions).toHaveBeenCalled();
  });
});

// ── Gateway resolver branches ──

describe('gatewayResolvers branches', () => {
  it('handles error in safe() wrapper for gateway', async () => {
    const ctx = mockCtx();
    // Task 6: Now uses ctx.ports.gateway
    (ctx.ports.gateway.getGatewayStatus as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection refused'));

    const { gatewayResolvers } = await import('../gateway.resolver.js');
    const resolvers = gatewayResolvers(ctx);
    const gateway = resolvers.Query!.gateway!;

    await expect((gateway as Function)({}, {})).rejects.toThrow('connection refused');
  });

  it('handles error in safe() wrapper for channels', async () => {
    const ctx = mockCtx();
    // Task 6: Now uses ctx.ports.gateway
    (ctx.ports.gateway.getGatewayStatus as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

    const { gatewayResolvers } = await import('../gateway.resolver.js');
    const resolvers = gatewayResolvers(ctx);
    const channels = resolvers.Query!.channels!;

    await expect((channels as Function)({}, {})).rejects.toThrow('fail');
  });

  it('handles error in safe() wrapper for resources', async () => {
    const ctx = mockCtx();
    // Phase 2: Now uses ctx.ports.system instead of ctx.systemInfoService
    (ctx.ports.system!.getSystemMetrics as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('metrics fail'));

    const { gatewayResolvers } = await import('../gateway.resolver.js');
    const resolvers = gatewayResolvers(ctx);
    const resources = resolvers.Query!.resources!;

    await expect((resources as Function)({}, {})).rejects.toThrow('metrics fail');
  });
});
