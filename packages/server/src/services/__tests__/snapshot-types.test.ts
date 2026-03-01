import { describe, expect, test, vi } from 'vitest';

import type { DataSources, SnapshotData, SnapshotSession } from '../snapshot-types';
import { parseSnapshotRequest } from '../snapshot-types';

describe('parseSnapshotRequest', () => {
  test('returns defaults for empty body', () => {
    const req = parseSnapshotRequest({});
    expect(req).toEqual({
      detail: 'standard',
      format: 'png',
      range: '24h',
      theme: 'dark',
      lang: 'en',
    });
  });

  test('accepts valid compact json request', () => {
    const req = parseSnapshotRequest({ detail: 'compact', format: 'json', range: '6h' });
    expect(req.detail).toBe('compact');
    expect(req.format).toBe('json');
    expect(req.range).toBe('6h');
  });

  test('throws on invalid detail', () => {
    expect(() => parseSnapshotRequest({ detail: 'ultra' })).toThrow('Invalid detail');
  });

  test('throws on invalid format', () => {
    expect(() => parseSnapshotRequest({ format: 'pdf' })).toThrow('Invalid format');
  });

  test('throws on invalid range', () => {
    expect(() => parseSnapshotRequest({ range: '48h' })).toThrow('Invalid range');
  });

  test('should accept format=svg', () => {
    const req = parseSnapshotRequest({ format: 'svg' });
    expect(req.format).toBe('svg');
  });

  test('should default range to 24h', () => {
    const req = parseSnapshotRequest({});
    expect(req.range).toBe('24h');
  });

  test('should accept range=30m', () => {
    const req = parseSnapshotRequest({ range: '30m' });
    expect(req.range).toBe('30m');
  });

  test('normalizes zh-CN to zh', () => {
    const req = parseSnapshotRequest({ lang: 'zh-CN' });
    expect(req.lang).toBe('zh');
  });

  test('falls back to en for unsupported lang', () => {
    const req = parseSnapshotRequest({ lang: 'fr' });
    expect(req.lang).toBe('en');
  });

  test('accepts zh directly', () => {
    const req = parseSnapshotRequest({ lang: 'zh' });
    expect(req.lang).toBe('zh');
  });

  test('falls back to en for non-string lang', () => {
    const req = parseSnapshotRequest({ lang: 123 });
    expect(req.lang).toBe('en');
  });
});

describe('snapshot type compatibility', () => {
  test('SnapshotSession includes turnCount', () => {
    const session: SnapshotSession = {
      name: 'Session 1',
      status: 'active',
      model: 'anthropic/claude-opus-4-6',
      modelDisplay: 'Claude Opus 4.6',
      channel: 'discord',
      totalTokens: 12345,
      totalTokensDisplay: '12.3k',
      usagePercent: 80,
      updatedAt: '1m ago',
      turnCount: 42,
      subAgentCount: 0,
    };
    expect(session.turnCount).toBe(42);
  });

  test('SnapshotData includes model token fields and no sparklines requirement', () => {
    const data: SnapshotData = {
      gateway: { status: 'up', version: '1.0.0', uptime: '1h', cpu: 10, memoryMB: 256 },
      channels: [{ name: 'Discord', provider: 'discord', connected: true, latencyMs: 12 }],
      timestamp: new Date().toISOString(),
      range: '24h',
      time: '12:34',
      summary: {
        activeSessions: 1,
        totalSessions: 2,
        tokens: 1000,
        tokensDisplay: '1.0k',
        errors: 0,
        warnings: 0,
        uptimePercent: 100,
        totalMessages: 0,
      },
      tokensByModel: [
        { model: 'anthropic/claude-opus-4-6', modelDisplay: 'Claude Opus 4.6', tokensK: 100, percent: 100 },
      ],
      tokensTrend: '↑12%',
      companionDays: 30,
      hostname: 'test-host',
      totalConversations: 100,
    };

    expect(data.tokensByModel).toHaveLength(1);
    expect(data.tokensTrend).toBe('↑12%');
  });

  test('SnapshotData allows null fields', () => {
    const data: SnapshotData = {
      gateway: null,
      channels: null,
      timestamp: new Date().toISOString(),
      range: '24h',
      time: '12:34',
      summary: null,
      tokensByModel: null,
      companionDays: null,
      hostname: 'test-host',
      totalConversations: null,
      _meta: { degradedSources: ['gateway'] },
    };
    expect(data.gateway).toBeNull();
    expect(data._meta?.degradedSources).toEqual(['gateway']);
  });

  test('DataSources requires token and turn methods', () => {
    const sources: DataSources = {
      getGateway: async () => ({ running: true, version: '1.0.0', uptime: '1h' }),
      getChannels: async () => [],
      getSessions: () => [],
      getMetrics: () => ({ totalTokensK: 0, totalErrors: 0, totalWarnings: 0, uptimePercent: 100, buckets: [] }),
      getRecentErrors: () => ({ events: [], total: 0, counts: { error: 0, warning: 0, restart: 0 } }),
      getModelTokenUsage: vi.fn().mockReturnValue([]),
      getTokenTrend: vi.fn().mockReturnValue(null),
      getTurnCounts: vi.fn().mockReturnValue({ total: 0, bySession: [] }),
      getCompanionDays: async () => 0,
      getTotalConversations: () => 0,
      getRangeMessageCount: () => 0,
    };

    expect(sources.getTurnCounts('', '').total).toBe(0);
  });
});
