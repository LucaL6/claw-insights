import { describe, it, expect } from 'vitest';
import { DatabaseSync } from 'node:sqlite';

describe('migration v6 upgrade path — existing v5 data preserved', () => {
  it('adds token_delta_k=0 to existing model_token_samples rows', () => {
    // Create a database with v5 schema (no token_delta_k on model_token_samples)
    const db = new DatabaseSync(':memory:');

    // Minimal v5 schema for model_token_samples
    db.exec(`
      CREATE TABLE IF NOT EXISTS model_token_samples (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp      TEXT NOT NULL,
        model          TEXT NOT NULL,
        total_tokens_k REAL NOT NULL DEFAULT 0
      );
    `);

    // Insert some v5-era data (no token_delta_k column)
    db.prepare('INSERT INTO model_token_samples (timestamp, model, total_tokens_k) VALUES (?, ?, ?)').run(
      '2026-02-01T10:00:00Z',
      'claude-opus-4-6',
      150.5,
    );
    db.prepare('INSERT INTO model_token_samples (timestamp, model, total_tokens_k) VALUES (?, ?, ?)').run(
      '2026-02-01T10:30:00Z',
      'gpt-4o',
      42.0,
    );

    // Verify column doesn't exist yet
    const colsBefore = (db.prepare('PRAGMA table_info(model_token_samples)').all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(colsBefore).not.toContain('token_delta_k');

    // Run the v6 migration logic
    const cols = (db.prepare('PRAGMA table_info(model_token_samples)').all() as { name: string }[]).map((c) => c.name);
    if (!cols.includes('token_delta_k')) {
      db.exec('ALTER TABLE model_token_samples ADD COLUMN token_delta_k REAL NOT NULL DEFAULT 0');
    }

    // Verify column exists
    const colsAfter = (db.prepare('PRAGMA table_info(model_token_samples)').all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(colsAfter).toContain('token_delta_k');

    // Verify existing rows have token_delta_k = 0
    const rows = db
      .prepare('SELECT model, total_tokens_k, token_delta_k FROM model_token_samples ORDER BY id')
      .all() as {
      model: string;
      total_tokens_k: number;
      token_delta_k: number;
    }[];

    expect(rows.length).toBe(2);
    expect(rows[0].model).toBe('claude-opus-4-6');
    expect(rows[0].total_tokens_k).toBe(150.5);
    expect(rows[0].token_delta_k).toBe(0);
    expect(rows[1].model).toBe('gpt-4o');
    expect(rows[1].total_tokens_k).toBe(42.0);
    expect(rows[1].token_delta_k).toBe(0);

    // Verify new inserts can use the column
    db.prepare(
      'INSERT INTO model_token_samples (timestamp, model, total_tokens_k, token_delta_k) VALUES (?, ?, ?, ?)',
    ).run('2026-02-01T11:00:00Z', 'claude-opus-4-6', 165.0, 14.5);
    const newRow = db.prepare('SELECT token_delta_k FROM model_token_samples ORDER BY id DESC LIMIT 1').get() as {
      token_delta_k: number;
    };
    expect(newRow.token_delta_k).toBe(14.5);

    db.close();
  });
});
