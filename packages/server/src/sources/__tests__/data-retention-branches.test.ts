import { describe, expect,it } from 'vitest';

import { initDatabase } from '../../db/init.js';
import { DataRetention, type RetentionConfig } from '../data-retention.js';

describe('DataRetention branch coverage', () => {
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
      `INSERT INTO hourly_metric_samples (hour, active_sessions_max, active_sessions_avg, token_delta_k, cost_end, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count)
       VALUES ('2020-01-01T00:00:00Z', 1, 1, 0, 0, 0, 0, 0, 0, 1)`,
    ).run();

    retention.runOnce();

    // Data should still be there since hourlyRetention is not a valid number
    const rows = db.prepare('SELECT * FROM hourly_metric_samples').all();
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
      `INSERT INTO hourly_metric_samples (hour, active_sessions_max, active_sessions_avg, token_delta_k, cost_end, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count)
       VALUES ('2020-01-01T00:00:00Z', 1, 1, 0, 0, 0, 0, 0, 0, 1)`,
    ).run();

    retention.runOnce();

    // hourlyRetention='0' → days=0, not > 0, so no pruning
    const rows = db.prepare('SELECT * FROM hourly_metric_samples').all();
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
      `INSERT INTO hourly_metric_samples (hour, active_sessions_max, active_sessions_avg, token_delta_k, cost_end, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count)
       VALUES ('2020-01-01T00:00:00Z', 1, 1, 0, 0, 0, 0, 0, 0, 1)`,
    ).run();

    retention.runOnce();

    const rows = db.prepare('SELECT * FROM hourly_metric_samples').all();
    expect(rows.length).toBe(1);

    retention.stop();
    db.close();
  });
});
