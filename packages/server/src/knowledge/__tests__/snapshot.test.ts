import { describe, expect, it, vi } from 'vitest';

import { buildSnapshot } from '../snapshot';

function mockDeps(overrides: Record<string, unknown> = {}) {
  return {
    sessionReader: {
      getSessions: () => [{ status: 'ACTIVE' }, { status: 'IDLE' }, { status: 'ACTIVE' }],
      getTotalTokensK: () => 500,
    },
    aggregator: {
      getMetrics: () => ({
        totalErrors: 10, totalWarnings: 5,
        buckets: [{ restartEvent: false }, { restartEvent: true }],
      }),
    },
    getSystemMetrics: vi.fn(async () => ({ cpu: 25, memoryMB: 512, diskMB: 80 })),
    getUsageCost: vi.fn(async () => ({ todayCost: 1.5 })),
    getGatewayRunning: vi.fn(async () => true),
    ...overrides,
  };
}

describe('buildSnapshot', () => {
  it('assembles SystemSnapshot from deps', async () => {
    const snap = await buildSnapshot(mockDeps());
    expect(snap.cpu).toBe(25);
    expect(snap.memoryMB).toBe(512);
    expect(snap.diskMB).toBe(80);
    expect(snap.activeSessions).toBe(2);
    expect(snap.totalTokensK).toBe(500);
    expect(snap.errorsLast24h).toBe(10);
    expect(snap.warningsLast24h).toBe(5);
    expect(snap.gatewayRunning).toBe(true);
    expect(snap.recentRestarts).toBe(1);
    expect(snap.costTodayUsd).toBe(1.5);
  });

  it('counts only ACTIVE sessions', async () => {
    const deps = mockDeps({
      sessionReader: { getSessions: () => [{ status: 'IDLE' }, { status: 'IDLE' }], getTotalTokensK: () => 0 },
    });
    const snap = await buildSnapshot(deps);
    expect(snap.activeSessions).toBe(0);
  });
});
