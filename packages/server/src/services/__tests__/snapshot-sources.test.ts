import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createSnapshotSources } from '../snapshot-sources.js';

vi.mock('../../db/message-queries.js', () => ({
  getRangeTurnCount: vi.fn(() => 3),
  getRangeTurnCountBySession: vi.fn(() => [
    { sessionKey: 'uuid-1', turns: 2 },
    { sessionKey: 'unknown-uuid', turns: 1 },
  ]),
}));

vi.mock('../../db/token-queries.js', () => ({
  getRangeModelTokenUsage: vi.fn(() => []),
  getRangeTokenUsageK: vi.fn(() => 0),
}));

vi.mock('../../db/event-queries.js', () => ({ queryEvents: vi.fn(() => []) }));
vi.mock('../../sources/gateway-cli.js', () => ({ createGatewayClient: vi.fn() }));
vi.mock('../../sources/system-info.js', () => ({ createSystemInfoService: vi.fn() }));
vi.mock('../../sources/companion-days.js', () => ({
  resolveCompanionSince: vi.fn(() => Promise.resolve(null)),
}));
vi.mock('../../db/system-queries.js', () => ({
  getCompanionSince: vi.fn(() => null),
}));
vi.mock('../../config.js', () => ({
  config: { deviceJsonPath: '/fake/device.json', openclawDir: '/fake/.openclaw' },
}));

import { getCompanionSince } from '../../db/system-queries.js';
import { resolveCompanionSince } from '../../sources/companion-days.js';

describe('createSnapshotSources.getTurnCounts', () => {
  it('maps turn-count session keys from sessionId to session key', () => {
    const ctx = {
      db: {},
      sessionReader: {
        getSessionIdToKeyMap: () => new Map([['uuid-1', 'agent:main:main']]),
        attachSubAgents: () => undefined,
        getSessions: () => [],
      },
      spawnTracker: { getParentChildMap: () => new Map() },
      aggregator: { getMetrics: () => ({}) },
    } as any;

    const sources = createSnapshotSources(ctx);
    const turns = sources.getTurnCounts('2026-01-01T00:00:00Z', '2026-01-01T01:00:00Z');

    expect(turns.total).toBe(3);
    expect(turns.bySession).toEqual([
      { sessionKey: 'agent:main:main', turns: 2 },
      { sessionKey: 'unknown-uuid', turns: 1 },
    ]);
  });
});

describe('createSnapshotSources.getCompanionDays', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no DB cache
    vi.mocked(getCompanionSince).mockReturnValue(null);
  });

  function makeCtx(overrides: Record<string, unknown> = {}) {
    return {
      db: {},
      sessionReader: {
        getSessionIdToKeyMap: () => new Map(),
        attachSubAgents: () => undefined,
        getSessions: () => [],
      },
      spawnTracker: { getParentChildMap: () => new Map() },
      aggregator: { getMetrics: () => ({}) },
      lifetimeScanner: {
        getStats: vi.fn(() => Promise.resolve({ createdAt: '2026-01-25T00:00:00.000Z' })),
      },
      ...overrides,
    } as any;
  }

  it('returns 0 when resolveCompanionSince returns null', async () => {
    vi.mocked(resolveCompanionSince).mockResolvedValueOnce(null);
    const sources = createSnapshotSources(makeCtx());
    expect(await sources.getCompanionDays()).toBe(0);
  });

  it('returns positive days when companion_since is resolved', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    vi.mocked(resolveCompanionSince).mockResolvedValueOnce(thirtyDaysAgo);
    const sources = createSnapshotSources(makeCtx());
    const days = await sources.getCompanionDays();
    expect(days).toBeGreaterThanOrEqual(30);
    expect(days).toBeLessThanOrEqual(31);
  });

  it('passes lifetimeScanner createdAt to resolveCompanionSince', async () => {
    vi.mocked(resolveCompanionSince).mockResolvedValueOnce('2026-01-25T00:00:00.000Z');
    const ctx = makeCtx();
    const sources = createSnapshotSources(ctx);
    await sources.getCompanionDays();
    expect(resolveCompanionSince).toHaveBeenCalledWith(
      ctx.db,
      expect.objectContaining({
        lifetimeCreatedAt: '2026-01-25T00:00:00.000Z',
      }),
    );
  });

  it('handles missing lifetimeScanner gracefully', async () => {
    vi.mocked(resolveCompanionSince).mockResolvedValueOnce(null);
    const sources = createSnapshotSources(makeCtx({ lifetimeScanner: undefined }));
    expect(await sources.getCompanionDays()).toBe(0);
    expect(resolveCompanionSince).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ lifetimeCreatedAt: null }),
    );
  });

  it('uses DB fast-path without calling lifetimeScanner or resolveCompanionSince', async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000).toISOString();
    vi.mocked(getCompanionSince).mockReturnValueOnce(thirtyDaysAgo);
    const ctx = makeCtx();
    const sources = createSnapshotSources(ctx);
    const days = await sources.getCompanionDays();
    expect(days).toBeGreaterThanOrEqual(30);
    expect(days).toBeLessThanOrEqual(31);
    // Fast path: no scanner call, no resolveCompanionSince call
    expect(ctx.lifetimeScanner.getStats).not.toHaveBeenCalled();
    expect(resolveCompanionSince).not.toHaveBeenCalled();
  });
});
