import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initDatabase } from '../../db/init';
import { Aggregator } from '../aggregator';

function setup() {
  const dbPath = join(tmpdir(), `agg-cov-${Date.now()}-${Math.random()}.db`);
  const db = initDatabase(dbPath);
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

describe('Aggregator coverage — timezone branches', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats timezone with half-hour offset (e.g. UTC+5:30)', () => {
    // India Standard Time: UTC+5:30 → getTimezoneOffset returns -330
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(-330);
    const { agg, cleanup } = setup();
    const result = agg.getMetrics(undefined, 'ONE_HOUR') as Record<string, unknown>;
    expect(result.timezone).toBe('UTC+5:30');
    cleanup();
  });

  it('formats timezone with negative offset (e.g. UTC-5)', () => {
    // Eastern Standard Time: UTC-5 → getTimezoneOffset returns 300
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(300);
    const { agg, cleanup } = setup();
    const result = agg.getMetrics(undefined, 'ONE_HOUR') as Record<string, unknown>;
    expect(result.timezone).toBe('UTC-5');
    cleanup();
  });

  it('formats timezone with negative half-hour offset (e.g. UTC-9:30)', () => {
    // Marquesas Islands: UTC-9:30 → getTimezoneOffset returns 570
    vi.spyOn(Date.prototype, 'getTimezoneOffset').mockReturnValue(570);
    const { agg, cleanup } = setup();
    const result = agg.getMetrics(undefined, 'ONE_HOUR') as Record<string, unknown>;
    expect(result.timezone).toBe('UTC-9:30');
    cleanup();
  });

  it('stale cache returns fresh data after TTL expires', () => {
    const { agg, cleanup } = setup();
    const r1 = agg.getMetrics(undefined, 'ONE_HOUR');
    // Advance time beyond cache TTL (60s)
    vi.advanceTimersByTime(61_000);
    const r2 = agg.getMetrics(undefined, 'ONE_HOUR');
    expect(r1).not.toBe(r2);
    cleanup();
  });
});
