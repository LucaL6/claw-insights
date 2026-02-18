import { describe, it, expect, vi } from 'vitest';
import { MetricsCollector } from '../metrics-collector.js';
import { initDatabase } from '../../../db/init.js';

describe('MetricsCollector branch coverage', () => {
  it('start() calls sampleSlow and handles rejection', async () => {
    const db = initDatabase(':memory:');
    const sessionReader = {
      getSessions: () => [],
      getTokensByModel: () => new Map(),
      getTotalTokensK: () => 0,
    };
    const getSystemMetrics = vi.fn().mockRejectedValue(new Error('metrics fail'));
    const getUsageCost = vi.fn().mockRejectedValue(new Error('cost fail'));
    const aggregator = { clearCache: vi.fn() };

    const collector = new MetricsCollector(
      db,
      sessionReader,
      getSystemMetrics,
      getUsageCost,
      aggregator,
      100_000,
      100_000,
    );

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    // start() calls sampleFast() synchronously and sampleSlow().catch()
    collector.start();

    // Wait for sampleSlow rejection to be caught
    await new Promise((r) => setTimeout(r, 50));

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[MetricsCollector]'),
      expect.any(Error),
    );

    collector.stop();
    warnSpy.mockRestore();
    db.close();
  });

  it('sampleFast with no aggregator does not throw', () => {
    const db = initDatabase(':memory:');
    const sessionReader = {
      getSessions: () => [{ key: 'a', status: 'ACTIVE', totalTokens: 1000 }],
      getTokensByModel: () => new Map([['claude', 5000]]),
      getTotalTokensK: () => 5,
    };

    // No aggregator passed (undefined)
    const collector = new MetricsCollector(
      db,
      sessionReader,
      () => ({ cpu: 0, memoryMB: 0, diskMB: 0, sampledAt: new Date().toISOString() }),
      () => ({ totalCost: 0, totalTokensM: 0, todayCost: 0, todayTokensM: 0, fetchedAt: '' }),
      undefined,
    );

    expect(() => collector.sampleFast()).not.toThrow();
    db.close();
  });
});
