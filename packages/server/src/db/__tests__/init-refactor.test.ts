import { mkdirSync, readdirSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

import type { Database } from '../database.js';
import { initDatabase } from '../init.js';
import { createSqliteDatabase } from '../sqlite-provider.js';

describe('initDatabase (refactored)', () => {
  function tmpPath(): string {
    const dir = join(tmpdir(), `db-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    return join(dir, 'test.db');
  }

  it('creates DB with all tables', () => {
    const db = initDatabase({ dbPath: tmpPath() });
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
      .all<{ name: string }>();
    const names = tables.map((t) => t.name);
    expect(names).toContain('metric_events');
    expect(names).toContain('token_usage_events');
    expect(names).toContain('system_samples');
    db.close();
  });

  it('accepts custom mkdir', () => {
    const mkdirFn = vi.fn();
    const db = initDatabase({ dbPath: ':memory:', mkdir: mkdirFn });
    expect(mkdirFn).toHaveBeenCalled();
    db.close();
  });

  it('accepts custom createDb factory', () => {
    const mockDb: Database = {
      prepare: vi.fn().mockReturnValue({
        run: vi.fn().mockReturnValue({ changes: 0, lastInsertRowid: 0 }),
        get: vi.fn().mockReturnValue({ v: null }),
        all: vi.fn().mockReturnValue([]),
      }),
      exec: vi.fn(),
      close: vi.fn(),
      transaction: vi.fn(),
    };
    const factory = vi.fn().mockReturnValue(mockDb);
    initDatabase({ dbPath: ':memory:', mkdir: () => {}, createDb: factory });
    expect(factory).toHaveBeenCalledWith(':memory:');
  });

  it('auto-rebuilds when old DB has higher schema version', () => {
    const path = tmpPath();
    // Create an "old" DB with schema_version = 99
    const oldDb = createSqliteDatabase(path);
    oldDb.exec('CREATE TABLE schema_version (version INTEGER PRIMARY KEY)');
    oldDb.prepare('INSERT INTO schema_version (version) VALUES (?)').run(99);
    oldDb.close();

    // initDatabase should backup + rebuild
    const db = initDatabase({ dbPath: path });
    const row = db.prepare('SELECT MAX(version) as v FROM schema_version').get<{ v: number }>();
    expect(row!.v).toBe(1); // rebuilt from scratch

    // .bak file should exist
    const dir = join(path, '..');
    const files = readdirSync(dir);
    const bakFiles = files.filter((f: string) => f.includes('.bak'));
    expect(bakFiles.length).toBeGreaterThanOrEqual(1);

    db.close();
  });
});
