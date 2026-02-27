import { describe, expect, it } from 'vitest';

import { initDatabase } from '../init';

describe('DB migrations', () => {
  it('should create schema_version table', () => {
    const db = initDatabase(':memory:');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'").all();
    expect(tables.length).toBe(1);
  });

  it('should apply all migrations', () => {
    const db = initDatabase(':memory:');
    const rows = db.prepare('SELECT version FROM schema_version ORDER BY version').all() as { version: number }[];
    const versions = rows.map((r) => r.version);
    expect(versions).toContain(1);
    expect(versions).toContain(2);
  });

  it('should be idempotent (running twice is safe)', () => {
    const db = initDatabase(':memory:');
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number };
    expect(row.v).toBeGreaterThanOrEqual(2);
  });

  it('should add module column via migration 2', () => {
    const db = initDatabase(':memory:');
    const info = db.prepare("PRAGMA table_info('metric_events')").all() as { name: string }[];
    const columns = info.map((c) => c.name);
    expect(columns).toContain('module');
  });

  it('should add category and source columns via migration 3', () => {
    const db = initDatabase(':memory:');
    const info = db.prepare("PRAGMA table_info('metric_events')").all() as { name: string }[];
    const columns = info.map((c) => c.name);
    expect(columns).toContain('category');
    expect(columns).toContain('source');
  });

  it('should create idx_events_category index', () => {
    const db = initDatabase(':memory:');
    const indexes = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_events_category'")
      .all();
    expect(indexes.length).toBe(1);
  });

  it('should backfill existing events with category and source', async () => {
    const db = initDatabase(':memory:');
    db.prepare(
      'INSERT INTO metric_events (timestamp, type, value, metadata, category, source) VALUES (?, ?, ?, ?, NULL, NULL)',
    ).run(new Date().toISOString(), 'error', null, null);

    const { backfillEventCategories } = await import('../init.js');
    backfillEventCategories(db);

    const row = db.prepare("SELECT category, source FROM metric_events WHERE type='error'").get() as {
      category: string;
      source: string;
    };
    expect(row.category).toBe('severity.error');
    expect(row.source).toBe('openclaw');
  });

  it('should backfill events where category is set but source is NULL', async () => {
    const db = initDatabase(':memory:');
    db.prepare(
      "INSERT INTO metric_events (timestamp, type, value, metadata, category, source) VALUES (?, ?, ?, ?, 'stale', NULL)",
    ).run(new Date().toISOString(), 'warning', null, null);

    const { backfillEventCategories } = await import('../init.js');
    backfillEventCategories(db);

    const row = db.prepare("SELECT category, source FROM metric_events WHERE type='warning'").get() as {
      category: string;
      source: string;
    };
    expect(row.category).toBe('severity.warning');
    expect(row.source).toBe('openclaw');
  });

  it('should apply migration 3 and reach version 3', () => {
    const db = initDatabase(':memory:');
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number };
    expect(row.v).toBeGreaterThanOrEqual(3);
  });

  it('should create hourly_system_samples table', () => {
    const db = initDatabase(':memory:');
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='hourly_system_samples'")
      .all();
    expect(tables.length).toBe(1);
  });

  it('should create token_usage_events table', () => {
    const db = initDatabase(':memory:');
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='token_usage_events'").all();
    expect(tables.length).toBe(1);
  });

  it('should create unique index on hourly_system_samples', () => {
    const db = initDatabase(':memory:');
    const idx1 = db
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_hourly_system_hour'")
      .all();
    expect(idx1.length).toBe(1);
  });

  it('should reach schema version 8', () => {
    const db = initDatabase(':memory:');
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number };
    expect(row.v).toBe(8);
  });
});
