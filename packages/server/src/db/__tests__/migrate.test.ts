import { describe, expect, it } from 'vitest';

import { MigrationVersionError,runMigrations } from '../migrate.js';
import { createSqliteDatabase } from '../sqlite-provider.js';

describe('runMigrations', () => {
  it('creates all tables on fresh DB', () => {
    const db = createSqliteDatabase(':memory:');
    runMigrations(db);

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")
      .all<{ name: string }>();
    const names = tables.map((t) => t.name);

    expect(names).toContain('schema_version');
    expect(names).toContain('metric_events');
    expect(names).toContain('token_usage_events');
    expect(names).toContain('system_samples');
    expect(names).toContain('hourly_system_samples');
    expect(names).toContain('message_events');
    expect(names).toContain('scan_state');
    expect(names).toContain('kv_meta');
    db.close();
  });

  it('sets schema_version to 1', () => {
    const db = createSqliteDatabase(':memory:');
    runMigrations(db);
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get<{ v: number }>();
    expect(row!.v).toBe(1);
    db.close();
  });

  it('is idempotent — running twice is safe', () => {
    const db = createSqliteDatabase(':memory:');
    runMigrations(db);
    runMigrations(db);
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get<{ v: number }>();
    expect(row!.v).toBe(1);
    db.close();
  });

  it('throws MigrationVersionError when DB version > max migration', () => {
    const db = createSqliteDatabase(':memory:');
    db.exec('CREATE TABLE schema_version (version INTEGER PRIMARY KEY)');
    db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(99);
    expect(() => runMigrations(db)).toThrow(MigrationVersionError);
    db.close();
  });

  it('schema matches old 12-migration result — critical columns exist', () => {
    const db = createSqliteDatabase(':memory:');
    runMigrations(db);

    const meCols = db.prepare('PRAGMA table_info(metric_events)').all<{ name: string }>();
    expect(meCols.map((c) => c.name)).toEqual(
      expect.arrayContaining(['id', 'timestamp', 'type', 'value', 'metadata', 'module', 'category', 'source']),
    );

    const msgCols = db.prepare('PRAGMA table_info(message_events)').all<{ name: string }>();
    expect(msgCols.map((c) => c.name)).toContain('content_hash');

    const ssCols = db.prepare('PRAGMA table_info(scan_state)').all<{ name: string }>();
    expect(ssCols.map((c) => c.name)).toContain('first_timestamp_ms');

    const tuSql = db
      .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='token_usage_events'")
      .get<{ sql: string }>();
    expect(tuSql!.sql).toContain('UNIQUE');

    db.close();
  });
});
