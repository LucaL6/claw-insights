import type { DatabaseSync as Database } from 'node:sqlite';

import { afterEach,describe, expect, it } from 'vitest';

import { initDatabase } from '../../db/init.js';
import { DataRetention } from '../data-retention.js';

let db: Database;
afterEach(() => db?.close());

function insertRawSamples(db: Database, hour: string, samples: Array<{ offsetMin: number; totalK: number; deltaK: number }>) {
  const stmt = db.prepare(
    `INSERT INTO metric_samples (timestamp, active_sessions, total_tokens_k, token_delta_k, cost_today, tokens_today_m, cpu, memory_mb)
     VALUES (?, 2, ?, ?, 1, 0.1, 5, 128)`,
  );
  for (const s of samples) {
    const ts = new Date(new Date(hour).getTime() + s.offsetMin * 60 * 1000).toISOString();
    stmt.run(ts, s.totalK, s.deltaK);
  }
}

function insertRawModelSamples(db: Database, hour: string, model: string, samples: Array<{ offsetMin: number; totalK: number; deltaK: number }>) {
  const stmt = db.prepare(
    `INSERT INTO model_token_samples (timestamp, model, total_tokens_k, token_delta_k) VALUES (?, ?, ?, ?)`,
  );
  for (const s of samples) {
    const ts = new Date(new Date(hour).getTime() + s.offsetMin * 60 * 1000).toISOString();
    stmt.run(ts, model, s.totalK, s.deltaK);
  }
}

describe('DataRetention hourly rollup uses SUM(token_delta_k)', () => {
  it('aggregates global tokens via SUM(delta), not MAX-MIN', () => {
    db = initDatabase(':memory:');
    const retention = new DataRetention(db, { rawRetentionDays: 0, hourlyRetention: 'permanent', aggregateIntervalMs: 999999 });

    // hour = 14:00, 3 samples. cumulative: 100→108→120 (MAX-MIN=20), deltas: 5+8+12=25
    insertRawSamples(db, '2026-02-10T14:00:00Z', [
      { offsetMin: 1, totalK: 100, deltaK: 5 },
      { offsetMin: 15, totalK: 108, deltaK: 8 },
      { offsetMin: 30, totalK: 120, deltaK: 12 },
    ]);

    retention.runOnce();

    const row = db.prepare('SELECT token_delta_k FROM hourly_metric_samples WHERE hour = ?').get('2026-02-10T14:00:00Z') as { token_delta_k: number };
    expect(row.token_delta_k).toBeCloseTo(25); // SUM(delta), not 20 (MAX-MIN)
  });

  it('aggregates per-model tokens via SUM(delta), not MAX-MIN', () => {
    db = initDatabase(':memory:');
    const retention = new DataRetention(db, { rawRetentionDays: 0, hourlyRetention: 'permanent', aggregateIntervalMs: 999999 });

    // Need metric_samples rows for the hour to trigger aggregation
    insertRawSamples(db, '2026-02-10T14:00:00Z', [
      { offsetMin: 1, totalK: 50, deltaK: 3 },
    ]);

    insertRawModelSamples(db, '2026-02-10T14:00:00Z', 'claude', [
      { offsetMin: 1, totalK: 50, deltaK: 3 },
      { offsetMin: 20, totalK: 58, deltaK: 8 },
    ]);

    retention.runOnce();

    const row = db.prepare('SELECT token_delta_k FROM hourly_model_tokens WHERE hour = ? AND model = ?').get('2026-02-10T14:00:00Z', 'claude') as { token_delta_k: number };
    expect(row.token_delta_k).toBeCloseTo(11); // 3 + 8
  });
});
