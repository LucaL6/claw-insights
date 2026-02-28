import { describe, expect, it, vi } from 'vitest';

import { buildSnapshotData } from '../services/snapshot-service.js';
import { getAppVersion } from '../version.js';

describe('snapshot performance', () => {
  it('buildSnapshotData completes within 500ms with cached data', async () => {
    const mockSources = {
      getGateway: vi.fn().mockResolvedValue({
        running: true,
        version: '1.0.0',
        uptime: '1d',
        cpu: 5,
        memoryMB: 128,
      }),
      getChannels: vi.fn().mockResolvedValue([]),
      getSessions: vi.fn().mockReturnValue([]),
      getMetrics: vi.fn().mockReturnValue({
        totalTokensK: 100,
        totalErrors: 5,
        totalWarnings: 10,
        uptimePercent: 99.5,
        buckets: [],
      }),
      getRecentErrors: vi.fn().mockReturnValue([]),
      getModelTokenUsage: vi.fn().mockReturnValue([]),
      getTokenTrend: vi.fn().mockReturnValue(null),
      getTurnCounts: vi.fn().mockReturnValue({ total: 0, bySession: [] }),
      getCompanionDays: async () => 58,
      getTotalConversations: () => 0,
      getRangeMessageCount: () => 0,
    };

    const start = performance.now();
    await buildSnapshotData(mockSources as unknown as import('../services/snapshot-types.js').DataSources, {
      detail: 'standard',
      range: 'TWENTY_FOUR_HOUR',
    });
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(500);
  });

  it('gateway + channels run concurrently, not sequentially', async () => {
    const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const mockSources = {
      getGateway: vi.fn().mockImplementation(async () => {
        await delay(100);
        return { running: true, version: '1.0.0', uptime: '1d', cpu: 5, memoryMB: 128 };
      }),
      getChannels: vi.fn().mockImplementation(async () => {
        await delay(100);
        return [];
      }),
      getSessions: vi.fn().mockReturnValue([]),
      getMetrics: vi.fn().mockReturnValue({
        totalTokensK: 0,
        totalErrors: 0,
        totalWarnings: 0,
        uptimePercent: 100,
        buckets: [],
      }),
      getRecentErrors: vi.fn().mockReturnValue([]),
      getModelTokenUsage: vi.fn().mockReturnValue([]),
      getTokenTrend: vi.fn().mockReturnValue(null),
      getTurnCounts: vi.fn().mockReturnValue({ total: 0, bySession: [] }),
      getCompanionDays: async () => 58,
      getTotalConversations: () => 0,
      getRangeMessageCount: () => 0,
    };

    const start = performance.now();
    await buildSnapshotData(mockSources as unknown as import('../services/snapshot-types.js').DataSources, {
      detail: 'compact',
      range: 'ONE_HOUR',
    });
    const elapsed = performance.now() - start;

    // If parallel: ~100ms. If sequential: ~200ms. Allow margin.
    expect(elapsed).toBeLessThan(180);
    expect(mockSources.getGateway).toHaveBeenCalledOnce();
    expect(mockSources.getChannels).toHaveBeenCalledOnce();
  });

  it('snapshot uses app version, not gateway CLI version', async () => {
    const mockSources = {
      getGateway: vi.fn().mockResolvedValue({
        running: true,
        version: '99.99.99', // fake gateway version — should NOT appear in output
        uptime: '1d',
        cpu: 5,
        memoryMB: 128,
      }),
      getChannels: vi.fn().mockResolvedValue([]),
      getSessions: vi.fn().mockReturnValue([]),
      getMetrics: vi.fn().mockReturnValue({
        totalTokensK: 0,
        totalErrors: 0,
        totalWarnings: 0,
        uptimePercent: 100,
        buckets: [],
      }),
      getRecentErrors: vi.fn().mockReturnValue([]),
      getModelTokenUsage: vi.fn().mockReturnValue([]),
      getTokenTrend: vi.fn().mockReturnValue(null),
      getTurnCounts: vi.fn().mockReturnValue({ total: 0, bySession: [] }),
      getCompanionDays: async () => 58,
      getTotalConversations: () => 0,
      getRangeMessageCount: () => 0,
    };

    const result = await buildSnapshotData(
      mockSources as unknown as import('../services/snapshot-types.js').DataSources,
      { detail: 'compact', range: 'ONE_HOUR' },
    );

    // Should use Claw-Insights app version, not mocked gateway version
    expect(result.gateway.version).toBe(getAppVersion());
    expect(result.gateway.version).not.toBe('99.99.99');
  });
});
