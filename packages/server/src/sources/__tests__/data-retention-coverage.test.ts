import { describe, expect, it } from 'vitest';

import { initDatabase } from '../../db/init.js';
import { DataRetention, type RetentionConfig } from '../data-retention.js';

const baseConfig: RetentionConfig = {
  rawRetentionDays: 0,
  hourlyRetention: 'permanent',
  aggregateIntervalMs: 60_000,
};

describe('DataRetention ?? 0 fallback branches', () => {
  it('aggregateHour with no matching rows hits ?? 0 fallbacks', () => {
    const db = initDatabase(':memory:');
    const retention = new DataRetention(db, baseConfig);

    // aggregateHour is private — the null ?? 0 path is only reachable when
    // MAX/AVG return null (no rows for that hour). The public aggregate()
    // only calls aggregateHour for hours WITH samples, so the null path
    // requires direct invocation. This is a defensive guard for race conditions
    // (rows deleted between distinct-hours query and per-hour aggregation).

    const callPrivate = retention as unknown as { aggregateHour(hour: string): void };
    const emptyHour = '2020-01-01T00:00:00Z';
    callPrivate.aggregateHour(emptyHour);

    const rows = db.prepare('SELECT * FROM hourly_system_samples').all() as Record<string, unknown>[];
    expect(rows.length).toBe(1);
    expect(rows[0].hour).toBe(emptyHour);
    expect(rows[0].active_sessions_max).toBe(0);
    expect(rows[0].active_sessions_avg).toBe(0);
    expect(rows[0].cpu_avg).toBe(0);
    expect(rows[0].cpu_max).toBe(0);
    expect(rows[0].memory_mb_avg).toBe(0);
    expect(rows[0].memory_mb_max).toBe(0);
    expect(rows[0].sample_count).toBe(0);

    db.close();
  });
});
