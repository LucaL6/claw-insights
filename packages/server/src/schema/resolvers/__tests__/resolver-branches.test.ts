import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context.js';

// ── Mocks ──

vi.mock('../../../sources/gateway-cli', () => ({
  getGatewayStatus: vi.fn(),
}));

vi.mock('../../../sources/system-info', () => ({
  getSystemMetrics: vi.fn(),
  getUsageCost: vi.fn(),
}));

vi.mock('../../../knowledge/engine', () => {
  class MockEngine {
    evaluate() {
      return [
        { id: 'r1', title: 'High CPU', severity: 'critical', message: 'CPU too high' },
        { id: 'r2', title: 'Warn', severity: 'warning', message: 'Warn msg' },
        { id: 'r3', title: 'Info', severity: 'info', message: 'Info msg' },
      ];
    }
  }
  return { DiagnosticEngine: MockEngine };
});

vi.mock('../../../knowledge/rules', () => ({
  diagnosticRules: [],
}));

vi.mock('../../../knowledge/snapshot', () => ({
  buildSnapshot: vi.fn().mockResolvedValue({
    cpu: 50,
    memoryMB: 1024,
    activeSessions: 3,
    errorsLast24h: 2,
  }),
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
    expect(ctx.sessionReader.getSessions).toHaveBeenCalledWith({
      activeOnly: undefined,
      sortBy: undefined,
    });
  });

  it('passes filter with actual values', async () => {
    const { sessionsResolvers } = await import('../sessions.resolver.js');
    const ctx = mockCtx();
    const resolvers = sessionsResolvers(ctx);
    const sessions = resolvers.Query!.sessions!;

    (sessions as Function)({}, { filter: { activeOnly: true, sortBy: 'RECENT' } });
    expect(ctx.sessionReader.getSessions).toHaveBeenCalledWith({
      activeOnly: true,
      sortBy: 'RECENT',
    });
  });
});

// ── Gateway resolver branches ──

describe('gatewayResolvers branches', () => {
  it('handles error in safe() wrapper for gateway', async () => {
    const { getGatewayStatus } = await import('../../../sources/gateway-cli.js');
    (getGatewayStatus as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('connection refused'));

    const { gatewayResolvers } = await import('../gateway.resolver.js');
    const resolvers = gatewayResolvers(mockCtx());
    const gateway = resolvers.Query!.gateway!;

    await expect((gateway as Function)({}, {})).rejects.toThrow('connection refused');
  });

  it('handles error in safe() wrapper for channels', async () => {
    const { getGatewayStatus } = await import('../../../sources/gateway-cli.js');
    (getGatewayStatus as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));

    const { gatewayResolvers } = await import('../gateway.resolver.js');
    const resolvers = gatewayResolvers(mockCtx());
    const channels = resolvers.Query!.channels!;

    await expect((channels as Function)({}, {})).rejects.toThrow('fail');
  });

  it('handles error in safe() wrapper for resources', async () => {
    const { getSystemMetrics } = await import('../../../sources/system-info.js');
    (getSystemMetrics as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('metrics fail'));

    const { gatewayResolvers } = await import('../gateway.resolver.js');
    const resolvers = gatewayResolvers(mockCtx());
    const resources = resolvers.Query!.resources!;

    await expect((resources as Function)({}, {})).rejects.toThrow('metrics fail');
  });
});

// ── Diagnostics resolver branches ──

describe('diagnosticsResolvers branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns findings with mapped severity and snapshot summary', async () => {
    const { getGatewayStatus } = await import('../../../sources/gateway-cli.js');
    (getGatewayStatus as ReturnType<typeof vi.fn>).mockResolvedValue({ running: true });

    const { diagnosticsResolvers } = await import('../diagnostics.resolver.js');
    const resolvers = diagnosticsResolvers(mockCtx());
    const diagnostics = resolvers.Query!.diagnostics!;

    const result = await (diagnostics as Function)({}, {});
    expect(result.findings).toHaveLength(3);
    expect(result.findings[0].severity).toBe('CRITICAL');
    expect(result.findings[1].severity).toBe('WARNING');
    expect(result.findings[2].severity).toBe('INFO');
    expect(result.snapshotSummary).toContain('CPU 50%');
    expect(result.evaluatedAt).toBeDefined();
  });

  it('handles getGatewayRunning throwing by returning null', async () => {
    // The inner try/catch in getGatewayRunning
    const { getGatewayStatus } = await import('../../../sources/gateway-cli.js');
    (getGatewayStatus as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('no gateway'));

    const { buildSnapshot } = await import('../../../knowledge/snapshot.js');
    // Verify buildSnapshot is called — the getGatewayRunning callback handles the error
    (buildSnapshot as ReturnType<typeof vi.fn>).mockImplementation(async (opts: Record<string, Function>) => {
      const running = await opts.getGatewayRunning();
      expect(running).toBeNull(); // error caught, returns null
      return { cpu: 10, memoryMB: 256, activeSessions: 1, errorsLast24h: 0 };
    });

    const { diagnosticsResolvers } = await import('../diagnostics.resolver.js');
    const resolvers = diagnosticsResolvers(mockCtx());
    const diagnostics = resolvers.Query!.diagnostics!;

    await (diagnostics as Function)({}, {});
  });

  it('handles safe() error wrapper for diagnostics', async () => {
    const { buildSnapshot } = await import('../../../knowledge/snapshot.js');
    (buildSnapshot as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('snapshot fail'));

    const { diagnosticsResolvers } = await import('../diagnostics.resolver.js');
    const resolvers = diagnosticsResolvers(mockCtx());
    const diagnostics = resolvers.Query!.diagnostics!;

    await expect((diagnostics as Function)({}, {})).rejects.toThrow('snapshot fail');
  });
});
