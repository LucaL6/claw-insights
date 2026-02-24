import { describe, test, expect } from 'vitest';
import { buildSnapshotData } from '../snapshot-service.js';
import type { DataSources } from '../snapshot-types.js';

function makeSources(overrides: Partial<DataSources> = {}): DataSources {
  return {
    getGateway: async () => ({ running: true, version: '1.0.0', uptime: '1d', cpu: 5, memoryMB: 128 }),
    getChannels: async () => [{ provider: 'discord', name: 'main', connected: true, latencyMs: 10 }],
    getSessions: () => [
      { displayName: 'S1', status: 'active', model: 'claude', channel: 'discord', totalTokens: 1000, usagePercent: 50, updatedAt: new Date().toISOString(), subAgents: [] },
    ],
    getMetrics: () => ({
      totalTokensK: 10,
      totalErrors: 1,
      totalWarnings: 0,
      uptimePercent: 100,
      buckets: Array.from({ length: 12 }, () => ({ sessions: 1, tokensK: 1, errors: 0, uptimePercent: 100 })),
    }),
    getRecentErrors: () => [{ timestamp: new Date().toISOString(), type: 'error', module: 'core', message: 'fail' }],
    ...overrides,
  };
}

describe('buildSnapshotData – branch coverage', () => {
  test('gateway down sets status to "down"', async () => {
    const result = await buildSnapshotData(
      makeSources({ getGateway: async () => ({ running: false, version: '1.0.0', uptime: '0' }) }),
      { detail: 'compact', range: '24h' },
    );
    expect(result.gateway.status).toBe('down');
    expect(result.gateway.cpu).toBe(0); // cpu ?? 0 fallback
    expect(result.gateway.memoryMB).toBe(0); // memoryMB ?? 0 fallback
  });

  test('bucket tokensK fallback to tokens field', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getMetrics: () => ({
          totalTokensK: 1,
          totalErrors: 0,
          totalWarnings: 0,
          uptimePercent: 100,
          buckets: [{ sessions: 1, tokens: 500, errors: 0, uptimePercent: 100 }],
        }),
      }),
      { detail: 'compact', range: '24h' },
    );
    // tokens sparkline should use the tokens field as fallback
    expect(result.sparklines.tokens.length).toBeGreaterThan(0);
  });

  test('unknown channel provider falls back to channel name', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getChannels: async () => [{ provider: 'matrix', name: 'my-room', connected: true, latencyMs: 5 }],
      }),
      { detail: 'compact', range: '24h' },
    );
    expect(result.channels[0].name).toBe('my-room');
  });

  test('known range maps to display string', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'compact', range: '24h' });
    // '24h' is not in RANGE_DISPLAY keys (those are like TWENTY_FOUR_HOUR), so falls through to raw range
    expect(result.range).toBe('24h');
  });

  test('session with missing fields uses defaults', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getSessions: () => [{ status: 'active' }], // minimal session
      }),
      { detail: 'full', range: '24h' },
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
      { detail: 'standard', range: '24h' },
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
      { detail: 'full', range: '24h' },
    );
    expect(result.recentErrors).toEqual(events);
  });

  test('full: getRecentErrors returning {events} with no events falls back to empty', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getRecentErrors: (() => ({})) as unknown as DataSources['getRecentErrors'],
      }),
      { detail: 'full', range: '24h' },
    );
    expect(result.recentErrors).toEqual([]);
  });

  test('sub-agent with missing fields uses defaults', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getSessions: () => [{
          displayName: 'S1', status: 'active', model: 'claude', totalTokens: 100,
          subAgents: [{}], // minimal sub-agent
        }],
      }),
      { detail: 'full', range: '24h' },
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
      { detail: 'standard', range: '24h' },
    );
    expect(result.sessions![0].name).toBe('fallback-name');
  });

  test('sub-agent name fallback: uses name when no displayName', async () => {
    const result = await buildSnapshotData(
      makeSources({
        getSessions: () => [{
          displayName: 'S1', status: 'active', totalTokens: 1,
          subAgents: [{ name: 'sub-fallback', status: 'done', completed: true }],
        }],
      }),
      { detail: 'full', range: '24h' },
    );
    expect(result.sessions![0].subAgents![0].name).toBe('sub-fallback');
  });
});
