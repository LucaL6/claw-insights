import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { initDatabase } from '../init';

function setup() {
  const dbPath = join(tmpdir(), `mig-v7-${Date.now()}-${Math.random()}.db`);
  const db = initDatabase(dbPath);
  return {
    db,
    dbPath,
    cleanup: () => {
      db.close();
      rmSync(dbPath, { force: true });
      rmSync(dbPath + '-wal', { force: true });
      rmSync(dbPath + '-shm', { force: true });
    },
  };
}

function tableExists(db: ReturnType<typeof initDatabase>, name: string): boolean {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name) as
    | { name: string }
    | undefined;
  return !!row;
}

function getColumns(db: ReturnType<typeof initDatabase>, table: string): string[] {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  return rows.map((r) => r.name);
}

describe('Migration v7', () => {
  it('creates token_usage_events table with correct schema', () => {
    const { db, cleanup } = setup();
    expect(tableExists(db, 'token_usage_events')).toBe(true);
    const cols = getColumns(db, 'token_usage_events');
    expect(cols).toContain('timestamp');
    expect(cols).toContain('session_key');
    expect(cols).toContain('model');
    expect(cols).toContain('input_tokens');
    expect(cols).toContain('output_tokens');
    expect(cols).toContain('cache_read');
    expect(cols).toContain('cache_write');
    cleanup();
  });

  it('creates system_samples table with correct schema', () => {
    const { db, cleanup } = setup();
    expect(tableExists(db, 'system_samples')).toBe(true);
    const cols = getColumns(db, 'system_samples');
    expect(cols).toContain('timestamp');
    expect(cols).toContain('active_sessions');
    expect(cols).toContain('cpu');
    expect(cols).toContain('memory_mb');
    expect(cols).not.toContain('token_delta_k');
    expect(cols).not.toContain('total_tokens_k');
    expect(cols).not.toContain('cost_today');
    cleanup();
  });

  it('creates hourly_system_samples table', () => {
    const { db, cleanup } = setup();
    expect(tableExists(db, 'hourly_system_samples')).toBe(true);
    cleanup();
  });

  it('renames old tables to _deprecated_*', () => {
    const { db, cleanup } = setup();
    expect(tableExists(db, 'metric_samples')).toBe(false);
    expect(tableExists(db, '_deprecated_metric_samples')).toBe(true);
    expect(tableExists(db, 'model_token_samples')).toBe(false);
    expect(tableExists(db, '_deprecated_model_token_samples')).toBe(true);
    expect(tableExists(db, 'hourly_metric_samples')).toBe(false);
    expect(tableExists(db, '_deprecated_hourly_metric_samples')).toBe(true);
    expect(tableExists(db, 'hourly_model_tokens')).toBe(false);
    expect(tableExists(db, '_deprecated_hourly_model_tokens')).toBe(true);
    cleanup();
  });

  it('migrates system metrics history from metric_samples to system_samples', () => {
    const { db, cleanup } = setup();
    const deprecatedCount = (
      db.prepare('SELECT COUNT(*) as cnt FROM _deprecated_metric_samples').get() as { cnt: number }
    ).cnt;
    const newCount = (db.prepare('SELECT COUNT(*) as cnt FROM system_samples').get() as { cnt: number }).cnt;
    expect(deprecatedCount).toBe(0);
    expect(newCount).toBe(0);
    cleanup();
  });

  it('token_usage_events enforces UNIQUE(timestamp, session_key, model)', () => {
    const { db, cleanup } = setup();
    const stmt = db.prepare(
      'INSERT INTO token_usage_events (timestamp, session_key, model, input_tokens, output_tokens, cache_read, cache_write) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    stmt.run('2026-01-01T00:00:00Z', 'sess-1', 'claude-opus-4-6', 100, 50, 10, 5);

    const stmt2 = db.prepare(
      'INSERT OR IGNORE INTO token_usage_events (timestamp, session_key, model, input_tokens, output_tokens, cache_read, cache_write) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    stmt2.run('2026-01-01T00:00:00Z', 'sess-1', 'claude-opus-4-6', 999, 999, 999, 999);

    const row = db.prepare('SELECT input_tokens FROM token_usage_events').get() as { input_tokens: number };
    expect(row.input_tokens).toBe(100);
    cleanup();
  });
});
