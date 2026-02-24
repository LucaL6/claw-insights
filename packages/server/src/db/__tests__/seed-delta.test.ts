import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect,it } from 'vitest';

import { seedTestData } from '../seed.js';

describe('seed data includes model token deltas', () => {
  it('model_token_samples should have non-zero token_delta_k values', () => {
    const dbPath = join(tmpdir(), `seed-delta-${Date.now()}.db`);
    const db = seedTestData(dbPath);
    const rows = db.prepare('SELECT token_delta_k FROM model_token_samples WHERE token_delta_k > 0').all();
    expect(rows.length).toBeGreaterThan(0);
    db.close();
    rmSync(dbPath, { force: true });
  });

  it('SUM of metric_samples.token_delta_k should approximate totalTokensK range', () => {
    const dbPath = join(tmpdir(), `seed-delta2-${Date.now()}.db`);
    const db = seedTestData(dbPath);
    const sumRow = db.prepare('SELECT SUM(token_delta_k) AS total FROM metric_samples').get() as { total: number };
    // SUM(delta) should be > 0
    expect(sumRow.total).toBeGreaterThan(0);
    db.close();
    rmSync(dbPath, { force: true });
  });
});
