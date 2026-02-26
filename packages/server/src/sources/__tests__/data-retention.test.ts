import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

import { initDatabase } from '../../db/init';
import { DataRetention, type RetentionConfig } from '../data-retention';

function setup(configOverrides: Partial<RetentionConfig> = {}) {
  const dbPath = join(tmpdir(), `dr-${Date.now()}-${Math.random()}.db`);
  const db = initDatabase(dbPath);
  const config: RetentionConfig = {
    rawRetentionDays: 7,
    hourlyRetention: 'permanent',
    aggregateIntervalMs: 60_000,
    ...configOverrides,
  };
  const retention = new DataRetention(db, config);
  return {
    db,
    retention,
    config,
    cleanup: () => {
      retention.stop();
      db.close();
      rmSync(dbPath, { force: true });
      rmSync(dbPath + '-wal', { force: true });
      rmSync(dbPath + '-shm', { force: true });
    },
  };
}

/** Get a UTC hour string N hours ago */
function hoursAgo(n: number): string {
  const d = new Date();
  d.setUTCMinutes(0, 0, 0);
  d.setUTCHours(d.getUTCHours() - n);
  return d.toISOString().replace(/\d{2}:\d{2}\.\d{3}Z$/, '00:00.000Z');
}

/** Get a UTC hour string N days ago */
function daysAgoHour(n: number): string {
  return hoursAgo(n * 24);
}

/** Insert N system_samples evenly across an hour */
function insertSamplesForHour(
  db: ReturnType<typeof initDatabase>,
  hourISO: string,
  count: number,
  overrides: Partial<{
    active_sessions: number;
    cpu: number;
    memory_mb: number;
  }> = {},
) {
  const baseTime = new Date(hourISO).getTime() + 1000; // offset 1s into the hour
  const step = Math.floor(3_500_000 / Math.max(count, 1)); // stay within the hour
  const insert = db.prepare(`
    INSERT INTO system_samples (timestamp, active_sessions, cpu, memory_mb)
    VALUES (?, ?, ?, ?)
  `);
  for (let i = 0; i < count; i++) {
    const ts = new Date(baseTime + i * step).toISOString();
    insert.run(ts, overrides.active_sessions ?? 2, overrides.cpu ?? 10, overrides.memory_mb ?? 256);
  }
}

describe('DataRetention', () => {
  it('aggregates completed hours into hourly_system_samples', () => {
    const { db, retention, cleanup } = setup();
    const hour = hoursAgo(3);

    insertSamplesForHour(db, hour, 6, { active_sessions: 3, cpu: 20, memory_mb: 512 });

    retention.runOnce();

    const rows = db.prepare('SELECT * FROM hourly_system_samples').all() as Record<string, unknown>[];
    expect(rows.length).toBe(1);
    expect(rows[0].active_sessions_max).toBe(3);
    expect(rows[0].sample_count).toBe(6);
    expect(rows[0].cpu_max).toBe(20);
    expect(rows[0].memory_mb_max).toBe(512);
    cleanup();
  });

  it('does NOT aggregate the current (incomplete) hour', () => {
    const { db, retention, cleanup } = setup();
    const currentHour = hoursAgo(0);

    insertSamplesForHour(db, currentHour, 3);

    retention.runOnce();

    const rows = db.prepare('SELECT * FROM hourly_system_samples').all() as Record<string, unknown>[];
    expect(rows.length).toBe(0);
    cleanup();
  });

  it('does NOT re-aggregate already-aggregated hours (idempotent)', () => {
    const { db, retention, cleanup } = setup();
    const hour = hoursAgo(3);

    insertSamplesForHour(db, hour, 4);
    retention.runOnce();
    expect((db.prepare('SELECT * FROM hourly_system_samples').all() as Record<string, unknown>[]).length).toBe(1);

    retention.runOnce();
    expect((db.prepare('SELECT * FROM hourly_system_samples').all() as Record<string, unknown>[]).length).toBe(1);
    cleanup();
  });

  it('prunes raw data older than rawRetentionDays when aggregated', () => {
    const { db, retention, cleanup } = setup({ rawRetentionDays: 1 });
    const hour = daysAgoHour(3);

    insertSamplesForHour(db, hour, 4);

    retention.runOnce();

    expect((db.prepare('SELECT * FROM hourly_system_samples').all() as Record<string, unknown>[]).length).toBe(1);
    expect((db.prepare('SELECT * FROM system_samples').all() as Record<string, unknown>[]).length).toBe(0);
    cleanup();
  });

  it('does NOT prune raw data when rawRetentionDays is 0', () => {
    const { db, retention, cleanup } = setup({ rawRetentionDays: 0 });
    const hour = daysAgoHour(3);

    insertSamplesForHour(db, hour, 4);
    retention.runOnce();

    expect((db.prepare('SELECT * FROM system_samples').all() as Record<string, unknown>[]).length).toBe(4);
    cleanup();
  });

  it('prunes hourly data when hourlyRetention is a number', () => {
    const { db, retention, cleanup } = setup({ rawRetentionDays: 0, hourlyRetention: '30' });
    const oldHour = daysAgoHour(60);

    db.prepare(
      `INSERT INTO hourly_system_samples (hour, active_sessions_max, active_sessions_avg, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count) VALUES (?, 5, 3, 5, 10, 256, 512, 10)`,
    ).run(oldHour);

    retention.runOnce();

    expect((db.prepare('SELECT * FROM hourly_system_samples').all() as Record<string, unknown>[]).length).toBe(0);
    cleanup();
  });

  it('prunes token_usage_events older than rawRetentionDays', () => {
    const { db, retention, cleanup } = setup({ rawRetentionDays: 1 });

    // Insert old token event (3 days ago)
    const oldTs = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const recentTs = new Date(Date.now() - 1000).toISOString();
    db.prepare(
      'INSERT INTO token_usage_events (timestamp, session_key, model, input_tokens, output_tokens, cache_read, cache_write) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(oldTs, 'sess-old', 'claude-3', 100, 50, 0, 0);
    db.prepare(
      'INSERT INTO token_usage_events (timestamp, session_key, model, input_tokens, output_tokens, cache_read, cache_write) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(recentTs, 'sess-new', 'claude-3', 200, 100, 0, 0);

    retention.runOnce();

    const rows = db.prepare('SELECT * FROM token_usage_events').all() as Record<string, unknown>[];
    expect(rows.length).toBe(1);
    expect(rows[0].session_key).toBe('sess-new');
    cleanup();
  });

  it('does NOT prune token_usage_events when rawRetentionDays is 0', () => {
    const { db, retention, cleanup } = setup({ rawRetentionDays: 0 });

    const oldTs = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare(
      'INSERT INTO token_usage_events (timestamp, session_key, model, input_tokens, output_tokens, cache_read, cache_write) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(oldTs, 'sess-old', 'claude-3', 100, 50, 0, 0);

    retention.runOnce();

    const rows = db.prepare('SELECT * FROM token_usage_events').all() as Record<string, unknown>[];
    expect(rows.length).toBe(1);
    cleanup();
  });

  it('guards against concurrent runOnce calls', () => {
    const { retention, cleanup } = setup();
    const r = retention as unknown as Record<string, unknown>;
    r.isRunning = true;

    const spy = vi.spyOn(r as any, 'aggregate');
    retention.runOnce();
    expect(spy).not.toHaveBeenCalled();

    r.isRunning = false;
    cleanup();
  });

  it('start/stop manages the timer', () => {
    const { retention, cleanup } = setup({ aggregateIntervalMs: 100_000 });
    expect((retention as unknown as Record<string, unknown>).timer).toBeNull();

    retention.start();
    expect((retention as unknown as Record<string, unknown>).timer).not.toBeNull();

    retention.stop();
    expect((retention as unknown as Record<string, unknown>).timer).toBeNull();
    cleanup();
  });
});
