import { describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context.js';
import { lifetimeResolvers } from '../lifetime.resolver.js';

function makeContext(overrides: Partial<{ getStats: ReturnType<typeof vi.fn> }> = {}): AppContext {
  return {
    gatewayClient: {
      getGatewayStatus: vi.fn().mockResolvedValue({ running: false }),
      getVersion: vi.fn().mockResolvedValue('0.0.0'),
      warmCache: vi.fn().mockResolvedValue(undefined),
    },
    systemInfoService: {
      getSystemMetrics: vi.fn().mockResolvedValue({ cpu: 0, memoryMB: 0 }),
      getUsageCost: vi.fn().mockResolvedValue({ totalCost: 0 }),
      resetMetricsCache: vi.fn(),
      resetCostCache: vi.fn(),
    },
    lifetimeScanner: {
      getStats: vi.fn().mockResolvedValue({
        isReady: true,
        createdAt: '2025-01-01T00:00:00.000Z',
        daysSinceCreation: 100,
        totalSessions: 42,
        totalInputTokens: 1_000_000,
        totalOutputTokens: 500_000,
        totalCacheReadTokens: 200_000,
        totalCacheWriteTokens: 100_000,
        totalTokens: 1_800_000,
        totalUserMessages: 1000,
        totalAssistantMessages: 1000,
      }),
      ...overrides,
    },
  } as unknown as AppContext;
}

describe('lifetimeResolvers', () => {
  it('returns stats from scanner', async () => {
    const ctx = makeContext();
    const resolvers = lifetimeResolvers(ctx);
    const result = await (resolvers.Query!.lifetimeStats as () => Promise<unknown>)();

    expect(ctx.lifetimeScanner.getStats).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      isReady: true,
      totalSessions: 42,
      totalTokens: 1_800_000,
    });
  });

  it('returns zeros when scanner not ready', async () => {
    const ctx = makeContext({
      getStats: vi.fn().mockResolvedValue({
        isReady: false,
        createdAt: new Date().toISOString(),
        daysSinceCreation: 0,
        totalSessions: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalCacheWriteTokens: 0,
        totalTokens: 0,
        totalUserMessages: 0,
        totalAssistantMessages: 0,
      }),
    });

    const resolvers = lifetimeResolvers(ctx);
    const result = (await (resolvers.Query!.lifetimeStats as () => Promise<unknown>)()) as Record<string, unknown>;

    expect(result.isReady).toBe(false);
    expect(result.totalSessions).toBe(0);
  });
});
