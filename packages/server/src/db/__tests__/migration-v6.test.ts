import { describe, expect,it } from 'vitest';

import { initDatabase } from '../init.js';

describe('migration v6 — model_token_samples.token_delta_k', () => {
  it('model_token_samples should have token_delta_k column after migration', () => {
    const db = initDatabase(':memory:');
    const cols = db.prepare('PRAGMA table_info(model_token_samples)').all() as { name: string }[];
    const colNames = cols.map((c) => c.name);
    expect(colNames).toContain('token_delta_k');
    db.close();
  });

  it('token_delta_k should default to 0', () => {
    const db = initDatabase(':memory:');
    db.prepare(
      `INSERT INTO model_token_samples (timestamp, model, total_tokens_k) VALUES (?, ?, ?)`,
    ).run('2026-01-01T00:00:00Z', 'test-model', 100);
    const row = db.prepare('SELECT token_delta_k FROM model_token_samples LIMIT 1').get() as { token_delta_k: number };
    expect(row.token_delta_k).toBe(0);
    db.close();
  });
});
