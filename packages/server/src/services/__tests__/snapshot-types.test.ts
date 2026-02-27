import { describe, expect, test, vi } from 'vitest';

import type { DataSources, SnapshotData, SnapshotSession } from '../snapshot-types';
import { parseSnapshotRequest } from '../snapshot-types';

describe('parseSnapshotRequest', () => {
  test('returns defaults for empty body', () => {
    const req = parseSnapshotRequest({});
    expect(req).toEqual({
      layout: 'desktop',
      detail: 'standard',
      format: 'png',
      range: '24h',
      theme: 'dark',
      lang: 'en',
      section: 'dashboard',
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

  test('should accept layout=mobile', () => {
    const req = parseSnapshotRequest({ layout: 'mobile' });
    expect(req.layout).toBe('mobile');
  });

  test('should default layout to desktop', () => {
    const req = parseSnapshotRequest({});
    expect(req.layout).toBe('desktop');
  });

  test('should accept section=logs', () => {
    const req = parseSnapshotRequest({ section: 'logs' });
    expect(req.section).toBe('logs');
  });

  test('should default section to dashboard', () => {
    const req = parseSnapshotRequest({});
    expect(req.section).toBe('dashboard');
  });

  test('throws on invalid layout', () => {
    expect(() => parseSnapshotRequest({ layout: 'tablet' })).toThrow('Invalid layout');
  });

  test('throws on invalid section', () => {
    expect(() => parseSnapshotRequest({ section: 'metrics' })).toThrow('Invalid section');
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

  test('DataSources requires token and turn methods', () => {
    const sources: DataSources = {
      getGateway: async () => ({ running: true, version: '1.0.0', uptime: '1h' }),
      getChannels: async () => [],
      getSessions: () => [],
      getMetrics: () => ({ totalTokensK: 0, totalErrors: 0, totalWarnings: 0, uptimePercent: 100, buckets: [] }),
      getRecentErrors: () => [],
      getModelTokenUsage: vi.fn().mockReturnValue([]),
      getTokenTrend: vi.fn().mockReturnValue(null),
      getTurnCounts: vi.fn().mockReturnValue({ total: 0, bySession: [] }),
      getStartedAt: () => null,
      getTotalConversations: () => 0,
    };

    expect(sources.getTurnCounts('', '').total).toBe(0);
  });
});
