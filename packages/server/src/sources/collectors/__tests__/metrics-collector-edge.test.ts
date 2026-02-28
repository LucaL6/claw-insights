import { afterEach, describe, expect, it, vi } from 'vitest';

import { initDatabase } from '../../../db/init.js';
import { SystemSampler } from '../metrics-collector.js';

vi.mock('../../../logger.js', () => ({
  createChildLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('SystemSampler edge branches', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stop() when timers are null (never started)', () => {
    const db = initDatabase(':memory:');
    const sampler = new SystemSampler(db, { getSessions: () => [] }, () => ({
      cpu: 0,
      memoryMB: 0,
      diskMB: 0,
      sampledAt: new Date().toISOString(),
    }));
    expect(() => sampler.stop()).not.toThrow();
    db.close();
  });

  it('fastTimer interval fires and calls sampleFast', () => {
    vi.useFakeTimers();
    const db = initDatabase(':memory:');
    const sampler = new SystemSampler(
      db,
      { getSessions: () => [{ key: 'a', status: 'ACTIVE' }] },
      () => Promise.resolve({ cpu: 10, memoryMB: 256, diskMB: 100, sampledAt: new Date().toISOString() }),
      { clearCache: vi.fn() },
      50,
      100_000,
    );

    const spy = vi.spyOn(sampler, 'sampleFast');
    sampler.start();
    // start() calls sampleFast once immediately
    expect(spy).toHaveBeenCalledTimes(1);

    // Advance to trigger the interval
    vi.advanceTimersByTime(50);
    expect(spy).toHaveBeenCalledTimes(2);

    sampler.stop();
    db.close();
  });
});
