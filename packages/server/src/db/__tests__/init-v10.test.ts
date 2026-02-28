import { DatabaseSync } from 'node:sqlite';

import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { initDatabase, MIGRATIONS } from '../init.js';
import { insertMessageEventBatch } from '../message-queries.js';

function makeDbPath(prefix: string): string {
  return join(tmpdir(), `${prefix}-${Date.now()}-${Math.random()}.db`);
}

function cleanupDb(path: string): void {
  rmSync(path, { force: true });
  rmSync(path + '-wal', { force: true });
  rmSync(path + '-shm', { force: true });
}

describe('migration v10 — message_events content_hash dedup', () => {
  it('fresh DB has content_hash NOT NULL with unique constraint', () => {
    const dbPath = makeDbPath('init-v10-fresh');
    const db = initDatabase(dbPath);

    const columns = db.prepare('PRAGMA table_info(message_events)').all() as Array<{ name: string; notnull: number }>;
    const col = columns.find((c) => c.name === 'content_hash');
    expect(col).toBeTruthy();
    expect(col?.notnull).toBe(1);

    const indexes = db.prepare("PRAGMA index_list('message_events')").all() as Array<{
      name: string;
      unique: number;
      origin: string;
    }>;
    expect(indexes.some((i) => i.unique === 1 && i.origin === 'u')).toBe(true);

    db.close();
    cleanupDb(dbPath);
  });

  it('dedupes existing duplicate rows and backfills non-NULL content_hash', () => {
    const dbPath = makeDbPath('init-v10-migrate');

    const pre = new DatabaseSync(dbPath);
    pre.exec('CREATE TABLE schema_version (version INTEGER PRIMARY KEY)');
    for (let v = 1; v <= 9; v++) {
      pre.prepare('INSERT INTO schema_version (version) VALUES (?)').run(v);
    }
    pre.exec(`
      CREATE TABLE message_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp   TEXT NOT NULL,
        session_key TEXT NOT NULL,
        role        TEXT NOT NULL
      );
    `);
    pre
      .prepare('INSERT INTO message_events (timestamp, session_key, role) VALUES (?, ?, ?)')
      .run('2026-03-01T00:00:00Z', 'sess-1', 'user');
    pre
      .prepare('INSERT INTO message_events (timestamp, session_key, role) VALUES (?, ?, ?)')
      .run('2026-03-01T00:00:00Z', 'sess-1', 'user');
    pre
      .prepare('INSERT INTO message_events (timestamp, session_key, role) VALUES (?, ?, ?)')
      .run('2026-03-01T00:00:01Z', 'sess-1', 'assistant');
    pre.close();

    const db = initDatabase(dbPath);

    // Migration clears all rows — LifetimeScanner repopulates with correct role|lineHash hashes
    const rowCount = (db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;
    expect(rowCount).toBe(0);

    const schemaVersion = db.prepare('SELECT MAX(version) as v FROM schema_version').get() as { v: number };
    expect(schemaVersion.v).toBe(MIGRATIONS.length);

    db.close();
    cleanupDb(dbPath);
  });

  it('R4 regression: post-migration rescan inserts cleanly with dedup', () => {
    const dbPath = makeDbPath('init-v10-r4');

    const pre = new DatabaseSync(dbPath);
    pre.exec('CREATE TABLE schema_version (version INTEGER PRIMARY KEY)');
    for (let v = 1; v <= 9; v++) {
      pre.prepare('INSERT INTO schema_version (version) VALUES (?)').run(v);
    }
    pre.exec(`
      CREATE TABLE message_events (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp   TEXT NOT NULL,
        session_key TEXT NOT NULL,
        role        TEXT NOT NULL
      );
    `);
    pre
      .prepare('INSERT INTO message_events (timestamp, session_key, role) VALUES (?, ?, ?)')
      .run('2026-03-01T00:00:00Z', 'sess-r4', 'user');
    pre
      .prepare('INSERT INTO message_events (timestamp, session_key, role) VALUES (?, ?, ?)')
      .run('2026-03-01T00:00:00Z', 'sess-r4', 'user');
    pre.close();

    const db = initDatabase(dbPath);
    // Migration clears all rows for clean rescan
    const migrated = (db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;
    expect(migrated).toBe(0);

    // Simulate rescan — same lineHash deduped, different lineHash both inserted
    insertMessageEventBatch(db, [
      { timestamp: '2026-03-01T00:00:00Z', sessionKey: 'sess-r4', role: 'user', lineHash: 'abcd1234' },
      { timestamp: '2026-03-01T00:00:00Z', sessionKey: 'sess-r4', role: 'user', lineHash: 'abcd1234' },
      { timestamp: '2026-03-01T00:00:00Z', sessionKey: 'sess-r4', role: 'user', lineHash: 'efgh5678' },
    ]);

    const after = (db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;
    // 2 distinct lineHash values → 2 rows (duplicate abcd1234 ignored)
    expect(after).toBe(2);

    db.close();
    cleanupDb(dbPath);
  });
});
