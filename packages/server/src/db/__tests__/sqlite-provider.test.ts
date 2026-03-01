import { describe, expect, it } from 'vitest';

import type { Database, RunResult } from '../database.js';
import { createSqliteDatabase } from '../sqlite-provider.js';

describe('SqliteProvider', () => {
  function memDb(): Database {
    const db = createSqliteDatabase(':memory:');
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT)');
    return db;
  }

  it('exec + prepare + run + get + all', () => {
    const db = memDb();
    const result: RunResult = db.prepare('INSERT INTO t (name) VALUES (?)').run('alice');
    expect(typeof result.changes).toBe('number');
    expect(typeof result.lastInsertRowid).toBe('number');

    const row = db.prepare('SELECT * FROM t WHERE id = ?').get<{ id: number; name: string }>(1);
    expect(row).toEqual({ id: 1, name: 'alice' });

    db.prepare('INSERT INTO t (name) VALUES (?)').run('bob');
    const rows = db.prepare('SELECT * FROM t ORDER BY id').all<{ id: number; name: string }>();
    expect(rows).toHaveLength(2);
    expect(rows[1].name).toBe('bob');

    db.close();
  });

  it('transaction commits on success', () => {
    const db = memDb();
    db.transaction((tx) => {
      tx.prepare('INSERT INTO t (name) VALUES (?)').run('alice');
      tx.prepare('INSERT INTO t (name) VALUES (?)').run('bob');
    });
    const rows = db.prepare('SELECT * FROM t').all();
    expect(rows).toHaveLength(2);
    db.close();
  });

  it('transaction rolls back on error', () => {
    const db = memDb();
    expect(() => {
      db.transaction((tx) => {
        tx.prepare('INSERT INTO t (name) VALUES (?)').run('alice');
        throw new Error('boom');
      });
    }).toThrow('boom');
    const rows = db.prepare('SELECT * FROM t').all();
    expect(rows).toHaveLength(0);
    db.close();
  });

  it('transaction returns value from fn', () => {
    const db = memDb();
    const count = db.transaction((tx) => {
      tx.prepare('INSERT INTO t (name) VALUES (?)').run('alice');
      return tx.prepare('SELECT COUNT(*) as cnt FROM t').get<{ cnt: number }>()!.cnt;
    });
    expect(count).toBe(1);
    db.close();
  });

  it('nested transaction is re-entrant', () => {
    const db = memDb();
    db.transaction((tx) => {
      tx.transaction((tx2) => {
        tx2.prepare('INSERT INTO t (name) VALUES (?)').run('nested');
      });
    });
    const row = db.prepare('SELECT name FROM t WHERE name = ?').get<{ name: string }>('nested');
    expect(row?.name).toBe('nested');
    db.close();
  });
});
