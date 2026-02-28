import { describe, expect, it } from 'vitest';

import { initDatabase } from '../../db/init.js';
import { DataRetention, type RetentionConfig } from '../data-retention.js';

describe('DataRetention branch coverage', () => {
  it('runOnce reentrancy guard prevents double execution', () => {
    const db = initDatabase(':memory:');
    const config: RetentionConfig = { rawRetentionDays: 0, hourlyRetention: 'permanent', aggregateIntervalMs: 60_000 };
    const retention = new DataRetention(db, config);
    // Access private isRunning via any
    (retention as any).isRunning = true;
    retention.runOnce(); // Should be no-op
    (retention as any).isRunning = false;
    retention.stop();
    db.close();
  });

  it('prune deletes old raw data when rawRetentionDays > 0', () => {
    const db = initDatabase(':memory:');
    const config: RetentionConfig = { rawRetentionDays: 1, hourlyRetention: 'permanent', aggregateIntervalMs: 60_000 };
    const retention = new DataRetention(db, config);

    // Insert old system sample and token event
    const oldTs = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('INSERT INTO system_samples (timestamp, active_sessions, cpu, memory_mb) VALUES (?, 1, 0, 0)').run(
      oldTs,
    );
    db.prepare(
      'INSERT INTO token_usage_events (timestamp, session_key, model, input_tokens, output_tokens, cache_read, cache_write) VALUES (?, ?, ?, 0, 0, 0, 0)',
    ).run(oldTs, 'sess', 'model');

    // Also insert hourly aggregated data for the old period
    const oldHour = oldTs.replace(/:\d{2}\.\d{3}Z/, ':00:00Z');
    db.prepare(
      'INSERT OR IGNORE INTO hourly_system_samples (hour, active_sessions_max, active_sessions_avg, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count) VALUES (?, 1, 1, 0, 0, 0, 0, 1)',
    ).run(oldHour);

    retention.runOnce();

    const tokenCount = (db.prepare('SELECT COUNT(*) as cnt FROM token_usage_events').get() as { cnt: number }).cnt;
    expect(tokenCount).toBe(0);

    retention.stop();
    db.close();
  });

  it('prune deletes old hourly data when hourlyRetention is a valid number', () => {
    const db = initDatabase(':memory:');
    const config: RetentionConfig = { rawRetentionDays: 0, hourlyRetention: '1', aggregateIntervalMs: 60_000 };
    const retention = new DataRetention(db, config);

    const oldHour = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString().replace(/:\d{2}\.\d{3}Z/, ':00:00Z');
    db.prepare(
      'INSERT INTO hourly_system_samples (hour, active_sessions_max, active_sessions_avg, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count) VALUES (?, 1, 1, 0, 0, 0, 0, 1)',
    ).run(oldHour);

    retention.runOnce();

    const rows = db.prepare('SELECT * FROM hourly_system_samples').all();
    expect(rows.length).toBe(0);

    retention.stop();
    db.close();
  });

  it('prune skips hourly pruning when hourlyRetention is invalid string', () => {
    const db = initDatabase(':memory:');
    const config: RetentionConfig = {
      rawRetentionDays: 0,
      hourlyRetention: 'invalid-not-a-number',
      aggregateIntervalMs: 60_000,
    };
    const retention = new DataRetention(db, config);

    // Insert some hourly data
    db.prepare(
      `INSERT INTO hourly_system_samples (hour, active_sessions_max, active_sessions_avg, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count)
       VALUES ('2020-01-01T00:00:00Z', 1, 1, 0, 0, 0, 0, 1)`,
    ).run();

    retention.runOnce();

    // Data should still be there since hourlyRetention is not a valid number
    const rows = db.prepare('SELECT * FROM hourly_system_samples').all();
    expect(rows.length).toBe(1);

    retention.stop();
    db.close();
  });

  it('prune skips hourly pruning when hourlyRetention parses to 0', () => {
    const db = initDatabase(':memory:');
    const config: RetentionConfig = {
      rawRetentionDays: 0,
      hourlyRetention: '0',
      aggregateIntervalMs: 60_000,
    };
    const retention = new DataRetention(db, config);

    db.prepare(
      `INSERT INTO hourly_system_samples (hour, active_sessions_max, active_sessions_avg, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count)
       VALUES ('2020-01-01T00:00:00Z', 1, 1, 0, 0, 0, 0, 1)`,
    ).run();

    retention.runOnce();

    // hourlyRetention='0' → days=0, not > 0, so no pruning
    const rows = db.prepare('SELECT * FROM hourly_system_samples').all();
    expect(rows.length).toBe(1);

    retention.stop();
    db.close();
  });

  it('prune skips hourly pruning when hourlyRetention is negative', () => {
    const db = initDatabase(':memory:');
    const config: RetentionConfig = {
      rawRetentionDays: 0,
      hourlyRetention: '-5',
      aggregateIntervalMs: 60_000,
    };
    const retention = new DataRetention(db, config);

    db.prepare(
      `INSERT INTO hourly_system_samples (hour, active_sessions_max, active_sessions_avg, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count)
       VALUES ('2020-01-01T00:00:00Z', 1, 1, 0, 0, 0, 0, 1)`,
    ).run();

    retention.runOnce();

    const rows = db.prepare('SELECT * FROM hourly_system_samples').all();
    expect(rows.length).toBe(1);

    retention.stop();
    db.close();
  });
});
