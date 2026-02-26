import { describe, expect, it, vi } from 'vitest';

import { initDatabase } from '../../../db/init.js';
import { SystemSampler } from '../metrics-collector.js';

const { mockWarn } = vi.hoisted(() => {
  const mockWarn = vi.fn();
  return { mockWarn };
});
vi.mock('../../../logger.js', () => ({
  createChildLogger: () => ({
    error: vi.fn(),
    warn: mockWarn,
    info: vi.fn(),
  }),
}));

describe('SystemSampler branch coverage', () => {
  it('start() calls sampleSlow and handles rejection', async () => {
    const db = initDatabase(':memory:');
    const sessionReader = {
      getSessions: () => [],
    };
    const getSystemMetrics = vi.fn().mockRejectedValue(new Error('metrics fail'));
    const aggregator = { clearCache: vi.fn() };

    const sampler = new SystemSampler(db, sessionReader, getSystemMetrics, aggregator, 100_000, 100_000);

    sampler.start();

    // Wait for sampleSlow rejection to be caught
    await new Promise((r) => setTimeout(r, 50));

    expect(mockWarn).toHaveBeenCalledWith(expect.objectContaining({ err: expect.any(Error) }), 'sampleSlow error');

    sampler.stop();
    db.close();
  });

  it('sampleFast with no aggregator does not throw', () => {
    const db = initDatabase(':memory:');
    const sessionReader = {
      getSessions: () => [{ key: 'a', status: 'ACTIVE' }],
    };

    const sampler = new SystemSampler(
      db,
      sessionReader,
      () => ({ cpu: 0, memoryMB: 0, diskMB: 0, sampledAt: new Date().toISOString() }),
      undefined,
    );

    expect(() => sampler.sampleFast()).not.toThrow();
    db.close();
  });
});
