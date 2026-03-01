import { describe, expect, test, vi } from 'vitest';

import { buildSnapshotData } from '../snapshot-service';
import type { DataSources } from '../snapshot-types';

function makeSources(sessionCount = 3): DataSources {
  const sessions = Array.from({ length: sessionCount }, (_, i) => ({
    displayName: `Session ${i}`,
    name: `session-${i}`,
    key: `session-${i}`,
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
    getRecentErrors: (limit: number) => ({
      events: Array.from({ length: limit }, (_, i) => ({
        timestamp: new Date().toISOString(),
        type: 'runtime',
        module: 'core',
        message: `error ${i}`,
      })),
      total: limit,
      counts: { error: limit, warning: 0, restart: 0 },
    }),
    getModelTokenUsage: vi.fn().mockReturnValue([
      { model: 'anthropic/claude-opus-4-6', tokensK: 100 },
      { model: 'openai/gpt-5', tokensK: 50 },
    ]),
    getTokenTrend: vi.fn().mockReturnValue(12),
    getTurnCounts: vi.fn().mockReturnValue({
      total: 20,
      bySession: sessions.map((s, i) => ({ sessionKey: String(s.key), turns: i + 1 })),
    }),
    getCompanionDays: async () => 30,
    getTotalConversations: () => 42,
    getRangeMessageCount: () => 0,
  };
}

describe('buildSnapshotData', () => {
  test('compact: has summary+model tokens, no sessions/buckets/errors', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'compact', range: 'TWENTY_FOUR_HOUR' });
    expect(result.summary).toBeDefined();
    expect(Array.isArray(result.tokensByModel)).toBe(true);
    expect(result.tokensByModel!.length).toBe(2);
    expect(result.tokensTrend).toBe('↑12%');
    expect(result).not.toHaveProperty('sparklines');
    expect(result.sessions).toBeUndefined();
    expect(result.buckets).toBeUndefined();
    expect(result.recentErrors).toBeUndefined();
  });

  test('standard: has sessions (no subAgents), has buckets', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'standard', range: 'TWENTY_FOUR_HOUR' });
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
    const result = await buildSnapshotData(makeSources(), { detail: 'full', range: 'TWENTY_FOUR_HOUR' });
    expect(result.sessions).toBeDefined();
    expect(result.buckets).toBeDefined();
    expect(result.recentErrors).toBeDefined();
    expect(result.recentErrors!.length).toBe(5);
    // full includes subAgents
    expect(result.sessions![0].subAgents).toBeDefined();
    expect(result.sessions![0].subAgents!.length).toBe(1);
  });

  test('sessions include turnCount from turn counts map', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'standard', range: 'ONE_HOUR' });
    expect(result.sessions?.[0].turnCount).toBeGreaterThan(0);
  });

  test('turn count lookup uses session key', async () => {
    const sources = makeSources();
    sources.getTurnCounts = vi.fn().mockReturnValue({
      total: 1,
      bySession: [{ sessionKey: 'session-0', turns: 9 }],
    });

    const result = await buildSnapshotData(sources, { detail: 'standard', range: 'ONE_HOUR' });
    expect(result.sessions?.[0].turnCount).toBe(9);
  });

  test('standard sessions capped at 8 (active only)', async () => {
    const result = await buildSnapshotData(makeSources(15), { detail: 'standard', range: 'TWENTY_FOUR_HOUR' });
    // 15 sessions, 5 active → capped at 5 (< 8)
    expect(result.sessions!.length).toBe(5);
    for (const s of result.sessions!) {
      expect(s.status).toBe('active');
    }
  });

  test('full sessions capped at 20 (active only)', async () => {
    const result = await buildSnapshotData(makeSources(90), { detail: 'full', range: 'TWENTY_FOUR_HOUR' });
    // 90 sessions, 30 active → capped at 20
    expect(result.sessions!.length).toBe(20);
    for (const s of result.sessions!) {
      expect(s.status).toBe('active');
    }
  });

  test('sessions use displayName over name', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'full', range: 'TWENTY_FOUR_HOUR' });
    expect(result.sessions![0].name).toBe('Session 0');
    expect(result.sessions![0].subAgents![0].name).toBe('Sub Agent 0A');
  });

  test('session status is lowercased', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'standard', range: 'TWENTY_FOUR_HOUR' });
    for (const sess of result.sessions!) {
      expect(sess.status).toMatch(/^[a-z]+$/);
    }
  });

  test('summary tokens is integer', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'compact', range: 'TWENTY_FOUR_HOUR' });
    expect(Number.isInteger(result.summary!.tokens)).toBe(true);
  });

  test('result includes time field', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'compact', range: 'TWENTY_FOUR_HOUR' });
    expect(result.time).toMatch(/^\d{2}:\d{2}$/);
  });

  test('channels use shortnames', async () => {
    const result = await buildSnapshotData(makeSources(), { detail: 'compact', range: 'TWENTY_FOUR_HOUR' });
    expect(result.channels![0].name).toBe('Discord');
  });

  test('groups models after top 5 into Other and keeps percentages at 100', async () => {
    const sources = makeSources();
    sources.getModelTokenUsage = vi.fn().mockReturnValue([
      { model: 'm1', tokensK: 40 },
      { model: 'm2', tokensK: 20 },
      { model: 'm3', tokensK: 15 },
      { model: 'm4', tokensK: 10 },
      { model: 'm5', tokensK: 5 },
      { model: 'm6', tokensK: 5 },
      { model: 'm7', tokensK: 5 },
    ]);

    const result = await buildSnapshotData(sources, { detail: 'compact', range: 'ONE_HOUR' });
    expect(result.tokensByModel).toHaveLength(6);
    expect(result.tokensByModel![5]).toMatchObject({ model: 'other', modelDisplay: 'Other', tokensK: 10 });
    expect(result.tokensByModel!.reduce((sum, m) => sum + m.percent, 0)).toBe(100);
  });

  test('adds ⚠️ prefix for trend >100%', async () => {
    const sources = { ...makeSources(), getTokenTrend: vi.fn().mockReturnValue(480) };
    const data = await buildSnapshotData(sources, { detail: 'standard', range: 'ONE_HOUR' });
    expect(data.tokensTrend).toBe('⚠️ ↑480%');
  });

  test('passes correct range to getTokenTrend', async () => {
    const spy = vi.fn().mockReturnValue(15);
    const sources = { ...makeSources(), getTokenTrend: spy };
    await buildSnapshotData(sources, { detail: 'standard', range: 'ONE_HOUR' });
    expect(spy).toHaveBeenCalledWith(60, expect.any(String));
  });

  test('activeSessions filter is case-insensitive', async () => {
    const sources = makeSources();
    const origGetSessions = sources.getSessions;
    sources.getSessions = () =>
      (origGetSessions() as { status: string }[]).map((s) => ({ ...s, status: s.status.toUpperCase() }));
    const result = await buildSnapshotData(sources, { detail: 'compact', range: 'TWENTY_FOUR_HOUR' });
    expect(result.summary!.activeSessions).toBe(1);
  });
});
