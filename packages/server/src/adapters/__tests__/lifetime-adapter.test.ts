import { describe, expect, it, vi } from 'vitest';

import { createLifetimeAdapter } from '../lifetime-adapter.js';

describe('LifetimeAdapter', () => {
  const mockManager = (isReadyVal: boolean) => ({
    getStats: vi.fn(() => ({
      isReady: isReadyVal,
      createdAt: '2026-01-01',
      daysSinceCreation: 30,
      totalSessions: 100,
      totalInputTokens: 1000,
      totalOutputTokens: 500,
      totalCacheReadTokens: 100,
      totalCacheWriteTokens: 50,
      totalTokens: 1650,
      totalUserMessages: 200,
      totalAssistantMessages: 200,
    })),
    isReady: vi.fn(() => isReadyVal),
  });

  it('isReady delegates to transcriptManager', () => {
    const manager = mockManager(true);
    const adapter = createLifetimeAdapter(manager as any);
    expect(adapter.isReady()).toBe(true);
    expect(manager.isReady).toHaveBeenCalled();
  });

  it('isReady returns false when not ready', () => {
    const manager = mockManager(false);
    const adapter = createLifetimeAdapter(manager as any);
    expect(adapter.isReady()).toBe(false);
  });

  it('getStats delegates to transcriptManager', () => {
    const manager = mockManager(true);
    const adapter = createLifetimeAdapter(manager as any);
    const stats = adapter.getStats();
    expect(stats.totalSessions).toBe(100);
    expect(manager.getStats).toHaveBeenCalled();
  });

  it('destroy is a no-op', () => {
    const manager = mockManager(true);
    const adapter = createLifetimeAdapter(manager as any);
    expect(() => adapter.destroy()).not.toThrow();
  });
});
