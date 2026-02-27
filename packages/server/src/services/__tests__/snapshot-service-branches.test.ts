import { describe, expect, test, vi } from 'vitest';

import { buildSnapshotData } from '../snapshot-service.js';
import type { DataSources } from '../snapshot-types.js';

function makeSources(overrides: Partial<DataSources> = {}): DataSources {
  return {
    getGateway: async () => ({ running: true, version: '1.0.0', uptime: '1d', cpu: 5, memoryMB: 128 }),
    getChannels: async () => [{ provider: 'discord', name: 'main', connected: true, latencyMs: 10 }],
    getSessions: () => [
      {
        displayName: 'S1',
        status: 'active',
        model: 'claude',
        channel: 'discord',
        totalTokens: 1000,
        usagePercent: 50,
        updatedAt: new Date().toISOString(),
        subAgents: [],
      },
    ],
    getMetrics: () => ({
      totalTokensK: 10,
      totalErrors: 1,
      totalWarnings: 0,
      uptimePercent: 100,
      buckets: Array.from({ length: 12 }, () => ({ sessions: 1, tokensK: 1, errors: 0, uptimePercent: 100 })),
    }),
    getRecentErrors: () => [{ timestamp: new Date().toISOString(), type: 'error', module: 'core', message: 'fail' }],
    getModelTokenUsage: vi.fn().mockReturnValue([{ model: 'claude', tokensK: 10 }]),
    getTokenTrend: vi.fn().mockReturnValue(5),
    getTurnCounts: vi.fn().mockReturnValue({ total: 1, bySession: [{ sessionKey: 'S1', turns: 1 }] }),
    getStartedAt: () => null,
    getTotalConversations: () => 0,
    getRangeMessageCount: () => 0,
    ...overrides,
  };
}

describe('buildSnapshotData – branch coverage', () => {
  test('gateway down sets status to "down"', async () => {
    const result = await buildSnapshotData(
      makeSources({ getGateway: async () => ({ running: false, version: '1.0.0', uptime: '0' }) }),
      { detail: 'compact', range: 'TWENTY_FOUR_HOUR' },
    );
    expect(result.gateway.status).toBe('down');
    expect(result.gateway.cpu).toBe(0); // cpu ?? 0 fallback
    expect(result.gateway.memoryMB).toBe(0); // memoryMB ?? 0 fallback
  });

  test('includes tokensByModel payload in compact result', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getModelTokenUsage: vi.fn().mockReturnValue([{ model: 'claude', tokensK: 12 }]),
      }),
      { detail: 'compact', range: 'TWENTY_FOUR_HOUR' },
    );
    expect(result.tokensByModel.length).toBe(1);
    expect(result).not.toHaveProperty('sparklines');
  });

  test('unknown channel provider falls back to channel name', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getChannels: async () => [{ provider: 'matrix', name: 'my-room', connected: true, latencyMs: 5 }],
      }),
      { detail: 'compact', range: 'TWENTY_FOUR_HOUR' },
    );
    expect(result.channels[0].name).toBe('my-room');
  });

  test('known range maps to display string', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'compact', range: 'TWENTY_FOUR_HOUR' });
    // '24h' is not in RANGE_DISPLAY keys (those are like TWENTY_FOUR_HOUR), so falls through to raw range
    expect(result.range).toBe('24h');
  });

  test('session with missing fields uses defaults', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getSessions: () => [{ status: 'active' }], // minimal session
      }),
      { detail: 'full', range: 'TWENTY_FOUR_HOUR' },
    );
    const sess = result.sessions![0];
    expect(sess.name).toBe('');
    expect(sess.model).toBe('');
    expect(sess.totalTokens).toBe(0);
    expect(sess.channel).toBe('');
    expect(sess.subAgentCount).toBe(0);
  });

  test('session with undefined status is excluded from active filter', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getSessions: () => [{ displayName: 'X', totalTokens: 1 }], // no status field
      }),
      { detail: 'standard', range: 'TWENTY_FOUR_HOUR' },
    );
    // undefined status → won't match 'active' filter
    expect(result.sessions!.length).toBe(0);
    expect(result.summary.activeSessions).toBe(0);
  });

  test('full: getRecentErrors returning {events} object', async () => {
    const events = [{ timestamp: new Date().toISOString(), type: 'error', module: 'gw', message: 'boom' }];
    const result = await buildSnapshotData(
      makeSources({
        getRecentErrors: (() => ({ events })) as unknown as DataSources['getRecentErrors'],
      }),
      { detail: 'full', range: 'TWENTY_FOUR_HOUR' },
    );
    expect(result.recentErrors).toEqual(events);
  });

  test('full: getRecentErrors returning {events} with no events falls back to empty', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getRecentErrors: (() => ({})) as unknown as DataSources['getRecentErrors'],
      }),
      { detail: 'full', range: 'TWENTY_FOUR_HOUR' },
    );
    expect(result.recentErrors).toEqual([]);
  });

  test('sub-agent with missing fields uses defaults', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getSessions: () => [
          {
            displayName: 'S1',
            status: 'active',
            model: 'claude',
            totalTokens: 100,
            subAgents: [{}], // minimal sub-agent
          },
        ],
      }),
      { detail: 'full', range: 'TWENTY_FOUR_HOUR' },
    );
    const sub = result.sessions![0].subAgents![0];
    expect(sub.name).toBe('');
    expect(sub.status).toBe('');
    expect(sub.completed).toBe(false);
  });

  test('session name fallback: uses name when no displayName', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getSessions: () => [{ name: 'fallback-name', status: 'active', totalTokens: 1, subAgents: [] }],
      }),
      { detail: 'standard', range: 'TWENTY_FOUR_HOUR' },
    );
    expect(result.sessions![0].name).toBe('fallback-name');
  });

  test('sub-agent name fallback: uses name when no displayName', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getSessions: () => [
          {
            displayName: 'S1',
            status: 'active',
            totalTokens: 1,
            subAgents: [{ name: 'sub-fallback', status: 'done', completed: true }],
          },
        ],
      }),
      { detail: 'full', range: 'TWENTY_FOUR_HOUR' },
    );
    expect(result.sessions![0].subAgents![0].name).toBe('sub-fallback');
  });
});
