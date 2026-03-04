import { describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context.js';
import { lifetimeResolvers } from '../lifetime.resolver.js';

function makeContext(overrides: Partial<{ getStats: ReturnType<typeof vi.fn> }> = {}): AppContext {
  const getStatsMock =
    overrides.getStats ??
    vi.fn().mockReturnValue({
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
    });

  return {
    ports: {
      lifetime: {
        getStats: getStatsMock,
        destroy: vi.fn(),
      },
    },
  } as unknown as AppContext;
}

describe('lifetimeResolvers', () => {
  it('returns stats from port', async () => {
    const ctx = makeContext();
    const resolvers = lifetimeResolvers(ctx);
    const result = await (resolvers.Query!.lifetimeStats as () => Promise<unknown>)();

    expect(ctx.ports.lifetime.getStats).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      isReady: true,
      totalSessions: 42,
      totalTokens: 1_800_000,
    });
  });

  it('returns zeros when scanner not ready', async () => {
    const ctx = makeContext({
      getStats: vi.fn().mockReturnValue({
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
