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
    getRecentErrors: () => ({
      events: [{ timestamp: new Date().toISOString(), type: 'error', module: 'core', message: 'fail' }],
      total: 1,
      counts: { error: 1, warning: 0, restart: 0 },
    }),
    getModelTokenUsage: vi.fn().mockReturnValue([{ model: 'claude', tokensK: 10 }]),
    getTokenTrend: vi.fn().mockReturnValue(5),
    getTurnCounts: vi.fn().mockReturnValue({ total: 1, bySession: [{ sessionKey: 'S1', turns: 1 }] }),
    getCompanionDays: async () => 0,
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
        getRecentErrors: () => ({ events, total: events.length, counts: { error: 1, warning: 0, restart: 0 } }),
      }),
      { detail: 'full', range: 'TWENTY_FOUR_HOUR' },
    );
    expect(result.recentErrors).toEqual(events);
  });

  test('full: getRecentErrors returning {events} with no events falls back to empty', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getRecentErrors: () => ({ events: [], total: 0, counts: { error: 0, warning: 0, restart: 0 } }),
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

  test('tokensByModel percent rounding correction adds remainder to first model', async () => {
    // 3 models with 1/3 each → Math.round(33.33) = 33 × 3 = 99, correction adds 1
    const result = await buildSnapshotData(
      makeSources({
        getModelTokenUsage: vi.fn().mockReturnValue([
          { model: 'a', tokensK: 1 },
          { model: 'b', tokensK: 1 },
          { model: 'c', tokensK: 1 },
        ]),
      }),
      { detail: 'compact', range: 'TWENTY_FOUR_HOUR' },
    );
    const percents = result.tokensByModel.map((m) => m.percent);
    expect(percents.reduce((s, p) => s + p, 0)).toBe(100);
  });

  test('negative token trend shows down arrow', async () => {
    const result = await buildSnapshotData(makeSources({ getTokenTrend: vi.fn().mockReturnValue(-15) }), {
      detail: 'standard',
      range: 'TWENTY_FOUR_HOUR',
    });
    expect(result.tokensTrend).toContain('↓');
    expect(result.tokensTrend).toContain('15%');
  });

  test('large positive trend shows warning prefix', async () => {
    const result = await buildSnapshotData(makeSources({ getTokenTrend: vi.fn().mockReturnValue(150) }), {
      detail: 'standard',
      range: 'TWENTY_FOUR_HOUR',
    });
    expect(result.tokensTrend).toContain('⚠️');
    expect(result.tokensTrend).toContain('↑');
  });

  test('more than 5 models groups rest into Other', async () => {
    const models = Array.from({ length: 7 }, (_, i) => ({ model: `model${i}`, tokensK: 10 }));
    const result = await buildSnapshotData(makeSources({ getModelTokenUsage: vi.fn().mockReturnValue(models) }), {
      detail: 'compact',
      range: 'TWENTY_FOUR_HOUR',
    });
    expect(result.tokensByModel.length).toBe(6); // 5 + Other
    expect(result.tokensByModel[5].model).toBe('other');
  });

  test('zero total model tokens gives 0% to all models', async () => {
    const result = await buildSnapshotData(
      makeSources({ getModelTokenUsage: vi.fn().mockReturnValue([{ model: 'x', tokensK: 0 }]) }),
      { detail: 'compact', range: 'TWENTY_FOUR_HOUR' },
    );
    expect(result.tokensByModel[0].percent).toBe(0);
  });

  test('zero token trend shows no trend', async () => {
    const result = await buildSnapshotData(makeSources({ getTokenTrend: vi.fn().mockReturnValue(0) }), {
      detail: 'standard',
      range: 'TWENTY_FOUR_HOUR',
    });
    expect(result.tokensTrend).toBeUndefined();
  });

  test('null token trend shows no trend', async () => {
    const result = await buildSnapshotData(makeSources({ getTokenTrend: vi.fn().mockReturnValue(null) }), {
      detail: 'standard',
      range: 'TWENTY_FOUR_HOUR',
    });
    expect(result.tokensTrend).toBeUndefined();
  });

  test('full detail with session having empty subAgents array', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getSessions: () => [
          {
            displayName: 'NoSubs',
            status: 'active',
            totalTokens: 100,
            subAgents: [],
          },
        ],
      }),
      { detail: 'full', range: 'TWENTY_FOUR_HOUR' },
    );
    expect(result.sessions![0].subAgents).toBeUndefined();
  });

  test('compact detail does not include sessions or buckets', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'compact', range: 'TWENTY_FOUR_HOUR' });
    expect(result.sessions).toBeUndefined();
    expect(result.buckets).toBeUndefined();
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
