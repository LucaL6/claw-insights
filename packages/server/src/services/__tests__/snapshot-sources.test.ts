import { describe, expect, it, vi } from 'vitest';

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
vi.mock('../../sources/gateway-cli.js', () => ({ getGatewayStatus: vi.fn(async () => ({ channels: [] })) }));
vi.mock('../../sources/system-info.js', () => ({ getSystemMetrics: vi.fn(async () => ({ cpu: 0, memoryMB: 0 })) }));

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
