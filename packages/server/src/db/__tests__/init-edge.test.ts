import { DatabaseSync } from 'node:sqlite';

import { mkdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../../logger.js', () => ({
  createChildLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}));

import { initDatabase, MIGRATIONS } from '../init.js';

function tmpDbPath() {
  const dir = join(tmpdir(), 'claw-test-edge-' + Date.now() + '-' + Math.random().toString(36).slice(2));
  mkdirSync(dir, { recursive: true });
  return join(dir, 'test.db');
}

describe('init.ts edge branches', () => {
  it('v7 handles already-renamed tables (dstExists=true, srcExists=true → skip)', () => {
    const path = tmpDbPath();
    const db = new DatabaseSync(path);
    db.exec('PRAGMA journal_mode=WAL');
    db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');

    db.exec(`
      CREATE TABLE metric_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL, type TEXT NOT NULL, value REAL, metadata TEXT,
        module TEXT, category TEXT, source TEXT
      );
      CREATE TABLE metric_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL, active_sessions INTEGER NOT NULL DEFAULT 0,
        total_tokens_k REAL NOT NULL DEFAULT 0, token_delta_k REAL NOT NULL DEFAULT 0,
        cost_today REAL NOT NULL DEFAULT 0, tokens_today_m REAL NOT NULL DEFAULT 0,
        cpu REAL NOT NULL DEFAULT 0, memory_mb INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_samples_time ON metric_samples(timestamp DESC);
      CREATE TABLE model_token_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL, model TEXT NOT NULL, total_tokens_k REAL NOT NULL DEFAULT 0,
        token_delta_k REAL NOT NULL DEFAULT 0
      );
      CREATE TABLE hourly_metric_samples (
        id INTEGER PRIMARY KEY AUTOINCREMENT, hour TEXT NOT NULL,
        active_sessions_max INTEGER DEFAULT 0, active_sessions_avg REAL DEFAULT 0,
        token_delta_k REAL DEFAULT 0, cost_end REAL DEFAULT 0,
        cpu_avg REAL DEFAULT 0, cpu_max REAL DEFAULT 0,
        memory_mb_avg REAL DEFAULT 0, memory_mb_max INTEGER DEFAULT 0,
        sample_count INTEGER DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_samples_hour ON hourly_metric_samples(hour);
      CREATE TABLE hourly_model_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT, hour TEXT NOT NULL,
        model TEXT NOT NULL, token_delta_k REAL DEFAULT 0
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_hourly_model_hour ON hourly_model_tokens(hour, model);
    `);

    // Also create the _deprecated tables so dst already exists
    db.exec('CREATE TABLE _deprecated_metric_samples (id INTEGER PRIMARY KEY)');
    db.exec('CREATE TABLE _deprecated_model_token_samples (id INTEGER PRIMARY KEY)');
    db.exec('CREATE TABLE _deprecated_hourly_metric_samples (id INTEGER PRIMARY KEY)');
    db.exec('CREATE TABLE _deprecated_hourly_model_tokens (id INTEGER PRIMARY KEY)');

    for (let v = 1; v <= 6; v++) {
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(v);
    }
    db.close();

    const db2 = initDatabase(path);
    const row = db2.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number };
    expect(row.v).toBe(MIGRATIONS.length);
    db2.close();
  });

  it('migration rollback on failure (catch branch)', () => {
    const path = tmpDbPath();
    const db = new DatabaseSync(path);
    db.exec('PRAGMA journal_mode=WAL');
    db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');

    // Create only metric_events but mark v1-v4 as done
    // v5 sanity check will fail because metric_samples table is missing
    db.exec(`
      CREATE TABLE metric_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL, type TEXT NOT NULL, value REAL, metadata TEXT,
        module TEXT, category TEXT, source TEXT
      );
    `);
    for (let v = 1; v <= 4; v++) {
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(v);
    }
    db.close();

    expect(() => initDatabase(path)).toThrow('Sanity check failed');
  });
});
