import { describe, test, expect } from 'vitest';
import { buildSnapshotData } from '../snapshot-service';
import type { DataSources } from '../snapshot-types';

function makeSources(sessionCount = 3): DataSources {
  const sessions = Array.from({ length: sessionCount }, (_, i) => ({
    displayName: `Session ${i}`,
    name: `session-${i}`,
    status: i < Math.max(1, Math.ceil(sessionCount / 3)) ? 'active' : 'idle',
    model: 'anthropic/claude-opus-4-6',
    channel: 'discord',
    totalTokens: (sessionCount - i) * 10_000,
    usagePercent: 50,
    updatedAt: new Date().toISOString(),
    subAgents: [
      {
        displayName: `Sub Agent ${i}A`,
        name: `sub-${i}-a`,
        status: 'running',
        completed: false,
        updatedAt: new Date().toISOString(),
      },
    ],
  }));

  const buckets = Array.from({ length: 24 }, (_, i) => ({
    sessions: i * 2,
    tokens: i * 100,
    errors: i % 3 === 0 ? i : 0,
    uptimePercent: i < 2 ? 80 : 100,
  }));

  return {
    getGateway: async () => ({ running: true, version: '1.2.3', uptime: '3d 2h', cpu: 12, memoryMB: 256 }),
    getChannels: async () => [{ provider: 'discord', name: 'main', connected: true, latencyMs: 42 }],
    getSessions: () => sessions,
    getMetrics: () => ({
      totalTokensK: 150,
      totalErrors: 7,
      totalWarnings: 3,
      uptimePercent: 99.5,
      buckets,
    }),
    getRecentErrors: (limit: number) =>
      Array.from({ length: limit }, (_, i) => ({
        timestamp: new Date().toISOString(),
        type: 'runtime',
        module: 'core',
        message: `error ${i}`,
      })),
  };
}

describe('buildSnapshotData', () => {
  test('compact: has summary+sparklines, no sessions/buckets/errors', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'compact', range: '24h' });
    expect(result.summary).toBeDefined();
    expect(result.sparklines).toBeDefined();
    expect(result.sparklines.sessions.length).toBe(12);
    expect(result.sessions).toBeUndefined();
    expect(result.buckets).toBeUndefined();
    expect(result.recentErrors).toBeUndefined();
  });

  test('standard: has sessions (no subAgents), has buckets', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'standard', range: '24h' });
    expect(result.sessions).toBeDefined();
    expect(result.buckets).toBeDefined();
    expect(result.sessions!.length).toBe(1); // only active sessions
    // no subAgents on standard
    for (const s of result.sessions!) {
      expect(s.subAgents).toBeUndefined();
      expect(s.subAgentCount).toBe(1);
      expect(s.status).toBe('active');
    }
    expect(result.recentErrors).toBeDefined();
    expect(result.recentErrors!.length).toBeLessThanOrEqual(3);
  });

  test('full: has sessions (with subAgents), buckets, recentErrors', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'full', range: '24h' });
    expect(result.sessions).toBeDefined();
    expect(result.buckets).toBeDefined();
    expect(result.recentErrors).toBeDefined();
    expect(result.recentErrors!.length).toBe(5);
    // full includes subAgents
    expect(result.sessions![0].subAgents).toBeDefined();
    expect(result.sessions![0].subAgents!.length).toBe(1);
  });

  test('sparklines are normalized to 0-100', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'compact', range: '1h' });
    for (const key of ['sessions', 'tokens', 'errors'] as const) {
      const arr = result.sparklines[key] as number[];
      for (const v of arr) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    }
    // last bucket has max sessions/tokens → should be 100
    expect(result.sparklines.sessions[result.sparklines.sessions.length - 1]).toBe(100);
  });

  test('standard sessions capped at 8 (active only)', async () => {
    const result = await buildSnapshotData(makeSources(15), { detail: 'standard', range: '24h' });
    // 15 sessions, 5 active → capped at 5 (< 8)
    expect(result.sessions!.length).toBe(5);
    for (const s of result.sessions!) {
      expect(s.status).toBe('active');
    }
  });

  test('full sessions capped at 20 (active only)', async () => {
    const result = await buildSnapshotData(makeSources(90), { detail: 'full', range: '24h' });
    // 90 sessions, 30 active → capped at 20
    expect(result.sessions!.length).toBe(20);
    for (const s of result.sessions!) {
      expect(s.status).toBe('active');
    }
  });

  test('sessions use displayName over name', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'full', range: '24h' });
    expect(result.sessions![0].name).toBe('Session 0');
    expect(result.sessions![0].subAgents![0].name).toBe('Sub Agent 0A');
  });

  test('session status is lowercased', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'standard', range: '24h' });
    for (const sess of result.sessions!) {
      expect(sess.status).toMatch(/^[a-z]+$/);
    }
  });

  test('summary tokens is integer', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'compact', range: '24h' });
    expect(Number.isInteger(result.summary.tokens)).toBe(true);
  });

  test('result includes time field', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'compact', range: '24h' });
    expect(result.time).toMatch(/^\d{2}:\d{2}$/);
  });

  test('channels use shortnames', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'compact', range: '24h' });
    expect(result.channels[0].name).toBe('Discord');
  });

  test('activeSessions filter is case-insensitive', async () => {
    const sources = makeSources();
    const origGetSessions = sources.getSessions;
    sources.getSessions = () => (origGetSessions() as { status: string }[]).map((s) => ({ ...s, status: s.status.toUpperCase() }));
    const result = await buildSnapshotData(sources, { detail: 'compact', range: '24h' });
    expect(result.summary.activeSessions).toBe(1);
  });
});
