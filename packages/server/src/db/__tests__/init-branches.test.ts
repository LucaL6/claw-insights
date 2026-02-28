import { DatabaseSync } from 'node:sqlite';

import { mkdirSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import type { RetentionConfig } from '../../sources/data-retention.js';
import { DataRetention } from '../../sources/data-retention.js';
import { initDatabase, MIGRATIONS } from '../init.js';

function tmpDbPath() {
  const dir = join(tmpdir(), 'claw-test-' + Date.now());
  mkdirSync(dir, { recursive: true });
  return join(dir, 'test.db');
}

describe('init.ts - hasColumn true branches (columns already exist)', () => {
  it('v2 skips ALTER when module already exists', () => {
    // Create a DB at v1 but with module column already present
    const path = tmpDbPath();
    const db = new DatabaseSync(path);
    db.exec('PRAGMA journal_mode=WAL');
    db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY)');
    db.exec(`
      CREATE TABLE metric_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL, type TEXT NOT NULL, value REAL, metadata TEXT,
        module TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_events_type_time ON metric_events(type, timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_time ON metric_events(timestamp DESC);
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
        timestamp TEXT NOT NULL, model TEXT NOT NULL, total_tokens_k REAL NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_model_samples_time ON model_token_samples(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_model_samples_model_time ON model_token_samples(model, timestamp);
    `);
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(1);
    db.close();

    // Now initDatabase will run v2+ migrations; v2 hasColumn('module') → true → skip
    const db2 = initDatabase(path);
    const row = db2.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number };
    expect(row.v).toBeGreaterThanOrEqual(7);
    // Old tables should be renamed to _deprecated
    const deprecated = db2
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_deprecated_metric_samples'")
      .all();
    expect(deprecated.length).toBe(1);
    db2.close();
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  });

  it('v3 skips ALTER when category/source already exist', () => {
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
      CREATE INDEX IF NOT EXISTS idx_events_type_time ON metric_events(type, timestamp);
      CREATE INDEX IF NOT EXISTS idx_events_time ON metric_events(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_events_module ON metric_events(module);
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
        timestamp TEXT NOT NULL, model TEXT NOT NULL, total_tokens_k REAL NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_model_samples_time ON model_token_samples(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_model_samples_model_time ON model_token_samples(model, timestamp);
    `);
    // Mark v1 and v2 as done
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(1);
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(2);
    db.close();

    // v3 hasColumn('category') → true, hasColumn('source') → true → skip ALTERs
    const db2 = initDatabase(path);
    const row = db2.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number };
    expect(row.v).toBeGreaterThanOrEqual(7);
    db2.close();
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  });

  it('v7 creates new tables and renames old ones', () => {
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
    for (let v = 1; v <= 6; v++) {
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(v);
    }
    db.close();

    const db2 = initDatabase(path);
    const row = db2.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number };
    expect(row.v).toBe(MIGRATIONS.length);
    // New tables exist
    const newTables = db2
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('system_samples','token_usage_events','hourly_system_samples')",
      )
      .all();
    expect(newTables.length).toBe(3);
    // Old tables deprecated
    const deprecated = db2
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '_deprecated_%'")
      .all();
    expect(deprecated.length).toBe(4);
    db2.close();
    try {
      unlinkSync(path);
    } catch {
      /* ignore */
    }
  });
});

describe('data-retention branches', () => {
  function createTestDb() {
    const db = initDatabase(':memory:');
    return db;
  }

  it('aggregate returns early when no hours need aggregation', () => {
    const db = createTestDb();
    const config: RetentionConfig = { rawRetentionDays: 7, hourlyRetention: '30', aggregateIntervalMs: 60000 };
    const retention = new DataRetention(db, config);
    // No data inserted → hours query returns empty → early return
    retention.runOnce();
    const rows = db.prepare('SELECT COUNT(*) as c FROM hourly_system_samples').get() as { c: number };
    expect(rows.c).toBe(0);
    db.close();
  });

  it('aggregates hour with no data (early return)', () => {
    const db = createTestDb();
    const config: RetentionConfig = { rawRetentionDays: 0, hourlyRetention: 'permanent', aggregateIntervalMs: 60000 };
    const retention = new DataRetention(db, config);

    // Insert a sample in a past hour so it gets aggregated
    const pastHour = new Date(Date.now() - 3 * 3600_000);
    pastHour.setMinutes(15, 0, 0);
    const ts = pastHour.toISOString();

    db.prepare(
      `
      INSERT INTO system_samples (timestamp, active_sessions, cpu, memory_mb)
      VALUES (?, 2, 30, 512)
    `,
    ).run(ts);

    retention.runOnce();

    const rows = db.prepare('SELECT * FROM hourly_system_samples').all() as Record<string, unknown>[];
    expect(rows.length).toBe(1);
    db.close();
  });

  it('prunes hourly data when hourlyRetention is a number', () => {
    const db = createTestDb();
    const config: RetentionConfig = { rawRetentionDays: 1, hourlyRetention: '1', aggregateIntervalMs: 60000 };
    const retention = new DataRetention(db, config);

    // Insert old hourly data
    const oldHour = new Date(Date.now() - 5 * 24 * 3600_000).toISOString().replace(/:\d{2}\.\d{3}Z/, ':00:00Z');
    db.prepare(
      'INSERT INTO hourly_system_samples (hour, active_sessions_max, active_sessions_avg, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count) VALUES (?, 1, 1, 0, 0, 0, 0, 1)',
    ).run(oldHour);

    retention.runOnce();

    const rows = db.prepare('SELECT COUNT(*) as c FROM hourly_system_samples').get() as { c: number };
    expect(rows.c).toBe(0); // pruned
    db.close();
  });

  it('guards against reentrant calls', () => {
    const db = createTestDb();
    const config: RetentionConfig = { rawRetentionDays: 0, hourlyRetention: 'permanent', aggregateIntervalMs: 60000 };
    const retention = new DataRetention(db, config);
    // Just verify runOnce completes without error when called twice rapidly
    retention.runOnce();
    retention.runOnce();
    db.close();
  });
});
