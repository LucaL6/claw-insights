import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  beforeEach(() => {
    vi.useFakeTimers();
    mockWarn.mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('start() calls sampleSlow and handles rejection', async () => {
    const db = initDatabase(':memory:');
    const sessionReader = {
      getSessions: () => [],
    };
    const metricsError = new Error('metrics fail');
    const getSystemMetrics = vi.fn().mockRejectedValue(metricsError);
    const aggregator = { clearCache: vi.fn() };

    const sampler = new SystemSampler(db, sessionReader, getSystemMetrics, aggregator, 100_000, 100_000);

    sampler.start();

    // Flush the rejected promise
    await vi.advanceTimersByTimeAsync(0);

    expect(getSystemMetrics).toHaveBeenCalledTimes(1);
    expect(mockWarn).toHaveBeenCalledWith(expect.objectContaining({ err: metricsError }), 'sampleSlow error');

    sampler.stop();
    db.close();
  });

  it('slowTimer interval catches sampleSlow errors', async () => {
    const db = initDatabase(':memory:');
    const getSystemMetrics = vi.fn().mockRejectedValue(new Error('interval fail'));
    const sampler = new SystemSampler(db, { getSessions: () => [] }, getSystemMetrics, undefined, 100_000, 50);

    sampler.start();
    // First call is immediate — flush it
    await vi.advanceTimersByTimeAsync(0);
    expect(getSystemMetrics).toHaveBeenCalledTimes(1);

    // Advance past interval to trigger second call
    await vi.advanceTimersByTimeAsync(50);
    expect(getSystemMetrics).toHaveBeenCalledTimes(2);

    sampler.stop();
    expect(mockWarn).toHaveBeenCalledTimes(2);
    db.close();
  });

  it('sampleFast with no aggregator processes sessions correctly', () => {
    const db = initDatabase(':memory:');
    const sessions = [
      { key: 'a', status: 'ACTIVE' },
      { key: 'b', status: 'IDLE' },
    ];
    const sessionReader = {
      getSessions: vi.fn(() => sessions),
    };

    const sampler = new SystemSampler(
      db,
      sessionReader,
      () => ({ cpu: 0, memoryMB: 0, diskMB: 0, sampledAt: new Date().toISOString() }),
      undefined,
    );

    expect(() => sampler.sampleFast()).not.toThrow();
    // Verify sessionReader was queried
    expect(sessionReader.getSessions).toHaveBeenCalled();
    db.close();
  });
});
