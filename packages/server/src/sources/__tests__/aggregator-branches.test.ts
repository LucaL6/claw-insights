import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { initDatabase } from '../../db/init.js';
import { Aggregator } from '../aggregator';

function setup() {
  const dbPath = join(tmpdir(), `agg-br-${Date.now()}-${Math.random()}.db`);
  const db = initDatabase({ dbPath });
  const agg = new Aggregator(db);
  return {
    db,
    agg,
    cleanup: () => {
      db.close();
      rmSync(dbPath, { force: true });
      rmSync(dbPath + '-wal', { force: true });
      rmSync(dbPath + '-shm', { force: true });
    },
  };
}

describe('Aggregator branches', () => {
  afterEach(() => {
    vi.useRealTimers();
  });
  it('getMetrics returns cached result on second call', () => {
    const { agg, cleanup } = setup();
    const r1 = agg.getMetrics(undefined, 'ONE_HOUR');
    const r2 = agg.getMetrics(undefined, 'ONE_HOUR');
    expect(r1).toBe(r2); // Same reference (cached)
    cleanup();
  });

  it('getMetrics with different params bypasses cache', () => {
    const { agg, cleanup } = setup();
    const r1 = agg.getMetrics(undefined, 'ONE_HOUR');
    const r2 = agg.getMetrics(undefined, 'SIX_HOUR');
    expect(r1).not.toBe(r2);
    cleanup();
  });

  it('clearCache invalidates the cache', () => {
    const { agg, cleanup } = setup();
    const r1 = agg.getMetrics(undefined, 'ONE_HOUR');
    agg.clearCache();
    const r2 = agg.getMetrics(undefined, 'ONE_HOUR');
    expect(r1).not.toBe(r2);
    cleanup();
  });

  it('getMetrics with explicit date', () => {
    const { agg, cleanup } = setup();
    const result = agg.getMetrics('2026-01-01', 'ONE_HOUR') as Record<string, unknown>;
    expect(result.date).toBe('2026-01-01');
    cleanup();
  });

  it('getMetrics returns timezone field and deterministic 15 buckets for THIRTY_MIN', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-07T03:46:00.000Z'));

    const { agg, cleanup } = setup();
    const result = agg.getMetrics(undefined, 'THIRTY_MIN') as {
      timezone: string;
      bucketMinutes: number;
      buckets: unknown[];
    };
    expect(typeof result.timezone).toBe('string');
    expect(result.timezone).toMatch(/^UTC[+-]/);
    expect(result.bucketMinutes).toBe(2);
    expect(result.buckets.length).toBe(15);
    cleanup();
  });
});
