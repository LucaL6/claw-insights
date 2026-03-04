import { describe, expect, it, vi } from 'vitest';

import { createSnapshotSources } from '../snapshot-sources.js';

vi.mock('../../db/message-queries.js', () => ({
  getRangeTurnCount: vi.fn(() => 10),
  getRangeTurnCountBySession: vi.fn(() => []),
}));

vi.mock('../../db/token-queries.js', () => ({
  getRangeModelTokenUsage: vi.fn(() => [{ model: 'claude', tokensK: 5 }]),
  getRangeTokenUsageK: vi.fn(),
}));

vi.mock('../../db/event-queries.js', () => ({ queryEvents: vi.fn(() => []) }));
vi.mock('../../sources/gateway-cli.js', () => ({ createGatewayClient: vi.fn() }));
vi.mock('../../sources/system-info.js', () => ({ createSystemInfoService: vi.fn() }));
vi.mock('../../sources/companion-days.js', () => ({ resolveCompanionSince: vi.fn() }));
vi.mock('../../db/system-queries.js', () => ({ getCompanionSince: vi.fn(() => null) }));
vi.mock('../../config.js', () => ({
  config: { deviceJsonPath: '/fake/device.json', openclawDir: '/fake/.openclaw' },
}));

import { getRangeTokenUsageK } from '../../db/token-queries.js';

function makeCtx() {
  const sessionData = [{ key: 's1', displayName: 'S1', status: 'ACTIVE' }];
  return {
    db: {},
    ports: {
      sessions: {
        getSessions: vi.fn(() => sessionData),
        getSessionById: vi.fn(),
        getSessionsInRange: vi.fn(),
        getSessionCount: vi.fn(),
        getSessionIdToKeyMap: vi.fn(() => new Map()),
        onChanged: vi.fn(),
      },
      metrics: {
        getMetrics: vi.fn(() => ({ totalTokensK: 50 })),
        getSessionTokens: vi.fn(() => 0),
        clearCache: vi.fn(),
        onChanged: vi.fn(),
      },
      gateway: {
        getGatewayStatus: vi.fn(() =>
          Promise.resolve({
            running: true,
            version: '1.0',
            uptime: '1h',
            channels: [{ provider: 'discord', name: 'main', connected: true }],
          }),
        ),
        getVersion: vi.fn(),
        warmCache: vi.fn(),
      },
      cron: undefined,
      logs: undefined,
      system: {
        getSystemMetrics: vi.fn(() =>
          Promise.resolve({
            cpu: 10,
            memoryMB: 256,
            diskMB: 512,
            uptime: '1h',
            platform: 'darwin',
            nodeVersion: 'v20.0.0',
          }),
        ),
        getProcessMetrics: vi.fn(),
      },
    },
    sessionReader: {
      getSessionIdToKeyMap: () => new Map(),
      attachSubAgents: vi.fn(),
      getSessions: vi.fn(() => sessionData),
    },
    spawnTracker: { getParentChildMap: vi.fn(() => new Map()) },
    aggregator: { getMetrics: vi.fn(() => ({ totalTokensK: 50 })) },
    gatewayClient: {
      getGatewayStatus: vi.fn(() =>
        Promise.resolve({
          running: true,
          version: '1.0',
          uptime: '1h',
          channels: [{ provider: 'discord', name: 'main', connected: true }],
        }),
      ),
    },
    systemInfoService: {
      getSystemMetrics: vi.fn(() => Promise.resolve({ cpu: 10, memoryMB: 256 })),
    },
    lifetimeScanner: { getStats: vi.fn() },
  } as any;
}

describe('createSnapshotSources branches', () => {
  it('getGateway merges system metrics', async () => {
    const ctx = makeCtx();
    const sources = createSnapshotSources(ctx);
    const gw = await sources.getGateway();
    expect(gw.cpu).toBe(10);
    expect(gw.memoryMB).toBe(256);
    expect(gw.running).toBe(true);
  });

  it('getChannels returns channels from gateway', async () => {
    const ctx = makeCtx();
    const sources = createSnapshotSources(ctx);
    const channels = await sources.getChannels();
    expect(channels).toHaveLength(1);
    expect(channels[0].provider).toBe('discord');
  });

  it('getSessions returns sessions from port', () => {
    const ctx = makeCtx();
    const sources = createSnapshotSources(ctx);
    const sessions = sources.getSessions();
    // attachSubAgents now handled by SpawnBus event-driven system (DESIGN-066)
    expect(sessions).toHaveLength(1);
  });

  it('getMetrics validates range and falls back to TWENTY_FOUR_HOUR', () => {
    const ctx = makeCtx();
    const sources = createSnapshotSources(ctx);
    sources.getMetrics('INVALID_RANGE');
    expect(ctx.ports.metrics.getMetrics).toHaveBeenCalledWith(undefined, 'TWENTY_FOUR_HOUR', expect.any(Object));
  });

  it('getMetrics uses valid range', () => {
    const ctx = makeCtx();
    const sources = createSnapshotSources(ctx);
    sources.getMetrics('ONE_HOUR');
    expect(ctx.ports.metrics.getMetrics).toHaveBeenCalledWith(undefined, 'ONE_HOUR', expect.any(Object));
  });

  it('getModelTokenUsage delegates to DB', () => {
    const ctx = makeCtx();
    const sources = createSnapshotSources(ctx);
    const result = sources.getModelTokenUsage('2026-01-01', '2026-01-02');
    expect(result).toEqual([{ model: 'claude', tokensK: 5 }]);
  });

  it('getTokenTrend returns null when prev is 0', () => {
    vi.mocked(getRangeTokenUsageK).mockReturnValueOnce(100).mockReturnValueOnce(0);
    const ctx = makeCtx();
    const sources = createSnapshotSources(ctx);
    const trend = sources.getTokenTrend(60, '2026-01-01T01:00:00Z');
    expect(trend).toBeNull();
  });

  it('getTokenTrend returns percent change when prev > 0', () => {
    vi.mocked(getRangeTokenUsageK).mockReturnValueOnce(150).mockReturnValueOnce(100);
    const ctx = makeCtx();
    const sources = createSnapshotSources(ctx);
    const trend = sources.getTokenTrend(60, '2026-01-01T01:00:00Z');
    expect(trend).toBe(50);
  });

  it('getTotalConversations returns turn count from epoch', () => {
    const ctx = makeCtx();
    const sources = createSnapshotSources(ctx);
    const count = sources.getTotalConversations();
    expect(count).toBe(10);
  });

  it('getRangeMessageCount delegates to DB', () => {
    const ctx = makeCtx();
    const sources = createSnapshotSources(ctx);
    const count = sources.getRangeMessageCount('2026-01-01', '2026-01-02');
    expect(count).toBe(10);
  });

  it('getRecentErrors delegates to queryEvents', () => {
    const ctx = makeCtx();
    const sources = createSnapshotSources(ctx);
    const result = sources.getRecentErrors(5);
    expect(result).toEqual([]);
  });
});
