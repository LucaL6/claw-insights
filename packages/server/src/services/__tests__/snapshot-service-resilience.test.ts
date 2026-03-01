import { describe, expect, it, vi } from 'vitest';

import { buildSnapshotData } from '../snapshot-service.js';
import type { DataSources } from '../snapshot-types.js';

function baseSources(): DataSources {
  return {
    getGateway: vi.fn().mockResolvedValue({ running: true, version: '1.0.0', uptime: '1d', cpu: 5, memoryMB: 128 }),
    getChannels: vi.fn().mockResolvedValue([]),
    getSessions: vi.fn().mockReturnValue([]),
    getMetrics: vi
      .fn()
      .mockReturnValue({ totalTokensK: 10, totalErrors: 0, totalWarnings: 0, uptimePercent: 99, buckets: [] }),
    getRecentErrors: vi.fn().mockReturnValue({ events: [], total: 0, counts: { error: 0, warning: 0, restart: 0 } }),
    getModelTokenUsage: vi.fn().mockReturnValue([]),
    getTokenTrend: vi.fn().mockReturnValue(null),
    getTurnCounts: vi.fn().mockReturnValue({ total: 0, bySession: [] }),
    getCompanionDays: vi.fn().mockResolvedValue(30),
    getTotalConversations: vi.fn().mockReturnValue(100),
    getRangeMessageCount: vi.fn().mockReturnValue(50),
  };
}

const opts = { detail: 'standard' as const, range: 'TWENTY_FOUR_HOUR' as const };

describe('snapshot service resilience', () => {
  it('gateway throws → gateway and channels null', async () => {
    const s = baseSources();
    (s.getGateway as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    const result = await buildSnapshotData(s, opts);
    expect(result.gateway).toBeNull();
    expect(result.channels).toBeNull();
  });

  it('tokensByModel throws → null', async () => {
    const s = baseSources();
    (s.getModelTokenUsage as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('db error');
    });
    const result = await buildSnapshotData(s, opts);
    expect(result.tokensByModel).toBeNull();
  });

  it('companionDays throws → null', async () => {
    const s = baseSources();
    (s.getCompanionDays as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    const result = await buildSnapshotData(s, opts);
    expect(result.companionDays).toBeNull();
  });

  it('summary null when metrics throws', async () => {
    const s = baseSources();
    (s.getMetrics as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('fail');
    });
    const result = await buildSnapshotData(s, opts);
    expect(result.summary).toBeNull();
  });

  it('sessions null when getSessions throws', async () => {
    const s = baseSources();
    (s.getSessions as ReturnType<typeof vi.fn>).mockImplementation(() => {
      throw new Error('fail');
    });
    const result = await buildSnapshotData(s, opts);
    expect(result.sessions).toBeNull();
  });

  it('degradedSources populated on failures', async () => {
    const s = baseSources();
    (s.getGateway as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    (s.getCompanionDays as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('fail'));
    const result = await buildSnapshotData(s, opts);
    expect(result._meta?.degradedSources).toContain('gateway');
    expect(result._meta?.degradedSources).toContain('channels'); // cascade from gateway
    expect(result._meta?.degradedSources).toContain('companionDays');
  });

  it('empty degradedSources when all succeed', async () => {
    const s = baseSources();
    const result = await buildSnapshotData(s, opts);
    expect(result._meta?.degradedSources).toEqual([]);
  });
});
