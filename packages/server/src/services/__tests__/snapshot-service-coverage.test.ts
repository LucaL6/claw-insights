import { describe, expect, it, vi } from 'vitest';

import { buildSnapshotData } from '../snapshot-service.js';
import type { DataSources } from '../snapshot-types.js';

function makeSources(overrides: Partial<DataSources> = {}): DataSources {
  return {
    getGateway: async () => ({ running: true, version: '1.0.0', uptime: '1d', cpu: 5, memoryMB: 128 }),
    getChannels: async () => [{ provider: 'discord', name: 'main', connected: true, latencyMs: 10 }],
    getSessions: () => [
      {
        displayName: 'S1', status: 'active', model: 'claude', channel: 'discord',
        totalTokens: 1000, usagePercent: 50, updatedAt: new Date().toISOString(), subAgents: [],
      },
    ],
    getMetrics: () => ({
      totalTokensK: 10, totalErrors: 1, totalWarnings: 0, uptimePercent: 100,
      buckets: Array.from({ length: 12 }, () => ({ sessions: 1, tokensK: 1, errors: 0, uptimePercent: 100 })),
    }),
    getRecentErrors: () => ({ events: [], total: 0, counts: { error: 0, warning: 0, restart: 0 } }),
    getModelTokenUsage: vi.fn().mockReturnValue([{ model: 'claude', tokensK: 10 }]),
    getTokenTrend: vi.fn().mockReturnValue(5),
    getTurnCounts: vi.fn().mockReturnValue({ total: 1, bySession: [{ sessionKey: 'S1', turns: 1 }] }),
    getCompanionDays: async () => 0,
    getTotalConversations: () => 0,
    getRangeMessageCount: () => 0,
    ...overrides,
  };
}

describe('buildSnapshotData coverage — degraded paths', () => {
  it('handles null sessions (getSessions throws) with metrics present', async () => {
    const result = await buildSnapshotData(
      makeSources({ getSessions: () => { throw new Error('db error'); } }),
      { detail: 'standard', range: 'TWENTY_FOUR_HOUR' },
    );
    // summary should still exist (metrics ok) with activeSessions=0
    expect(result.summary).not.toBeNull();
    expect(result.summary!.activeSessions).toBe(0);
    // sessions should be null
    expect(result.sessions).toBeNull();
    expect(result._meta!.degradedSources).toContain('sessions');
  });

  it('handles null metrics (getMetrics throws) — summary is null', async () => {
    const result = await buildSnapshotData(
      makeSources({ getMetrics: () => { throw new Error('db error'); } }),
      { detail: 'compact', range: 'TWENTY_FOUR_HOUR' },
    );
    expect(result.summary).toBeNull();
    expect(result._meta!.degradedSources).toContain('metrics');
  });

  it('standard detail with null sessions still includes recentErrors', async () => {
    const result = await buildSnapshotData(
      makeSources({ getSessions: () => { throw new Error('fail'); } }),
      { detail: 'standard', range: 'TWENTY_FOUR_HOUR' },
    );
    expect(result.sessions).toBeNull();
    // _meta records the degraded source
    expect(result._meta!.degradedSources).toContain('sessions');
  });

  it('full detail with null sessions still works', async () => {
    const result = await buildSnapshotData(
      makeSources({ getSessions: () => { throw new Error('fail'); } }),
      { detail: 'full', range: 'TWENTY_FOUR_HOUR' },
    );
    expect(result.sessions).toBeNull();
  });
});
