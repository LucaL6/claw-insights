import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { initDatabase } from '../init';
import {
  deleteAllMessageEvents,
  getRangeTurnCount,
  getRangeTurnCountBySession,
  insertMessageEvent,
  insertMessageEventBatch,
} from '../message-queries';

function setup() {
  const dbPath = join(tmpdir(), `mq-${Date.now()}-${Math.random()}.db`);
  const db = initDatabase(dbPath);
  return {
    db,
    cleanup: () => {
      db.close();
      rmSync(dbPath, { force: true });
      rmSync(dbPath + '-wal', { force: true });
      rmSync(dbPath + '-shm', { force: true });
    },
  };
}

describe('message-queries', () => {
  it('insertMessageEvent inserts a row', () => {
    const { db, cleanup } = setup();

    insertMessageEvent(db, {
      timestamp: '2026-02-27T10:00:00Z',
      sessionKey: 'sess-1',
      role: 'user',
    });

    const row = db.prepare('SELECT timestamp, session_key, role FROM message_events').get() as {
      timestamp: string;
      session_key: string;
      role: string;
    };
    expect(row.timestamp).toBe('2026-02-27T10:00:00Z');
    expect(row.session_key).toBe('sess-1');
    expect(row.role).toBe('user');

    cleanup();
  });

  it('insertMessageEventBatch inserts rows in one transaction path', () => {
    const { db, cleanup } = setup();

    insertMessageEventBatch(db, [
      { timestamp: '2026-02-27T10:00:00Z', sessionKey: 'sess-1', role: 'user' },
      { timestamp: '2026-02-27T10:00:01Z', sessionKey: 'sess-1', role: 'assistant' },
      { timestamp: '2026-02-27T10:00:02Z', sessionKey: 'sess-2', role: 'tool' },
    ]);

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;
    expect(count).toBe(3);

    cleanup();
  });

  it('getRangeTurnCount counts only user+assistant turns in range', () => {
    const { db, cleanup } = setup();

    insertMessageEventBatch(db, [
      { timestamp: '2026-02-27T09:59:59Z', sessionKey: 'sess-1', role: 'user' },
      { timestamp: '2026-02-27T10:00:00Z', sessionKey: 'sess-1', role: 'user' },
      { timestamp: '2026-02-27T10:00:01Z', sessionKey: 'sess-1', role: 'assistant' },
      { timestamp: '2026-02-27T10:00:02Z', sessionKey: 'sess-1', role: 'tool' },
      { timestamp: '2026-02-27T10:00:03Z', sessionKey: 'sess-2', role: 'assistant' },
      { timestamp: '2026-02-27T10:10:00Z', sessionKey: 'sess-2', role: 'user' },
    ]);

    const turns = getRangeTurnCount(db, '2026-02-27T10:00:00Z', '2026-02-27T10:10:00Z');
    expect(turns).toBe(3);

    cleanup();
  });

  it('deleteAllMessageEvents removes all rows', () => {
    const { db, cleanup } = setup();

    insertMessageEventBatch(db, [
      { timestamp: '2026-02-27T10:00:00Z', sessionKey: 'sess-a', role: 'user' },
      { timestamp: '2026-02-27T10:00:01Z', sessionKey: 'sess-a', role: 'assistant' },
    ]);

    deleteAllMessageEvents(db);

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;
    expect(count).toBe(0);

    cleanup();
  });

  it('getRangeTurnCountBySession groups and orders by turns desc', () => {
    const { db, cleanup } = setup();

    insertMessageEventBatch(db, [
      { timestamp: '2026-02-27T10:00:00Z', sessionKey: 'sess-a', role: 'user' },
      { timestamp: '2026-02-27T10:00:01Z', sessionKey: 'sess-a', role: 'assistant' },
      { timestamp: '2026-02-27T10:00:02Z', sessionKey: 'sess-a', role: 'tool' },
      { timestamp: '2026-02-27T10:00:03Z', sessionKey: 'sess-b', role: 'user' },
      { timestamp: '2026-02-27T10:00:04Z', sessionKey: 'sess-b', role: 'assistant' },
      { timestamp: '2026-02-27T10:00:05Z', sessionKey: 'sess-b', role: 'assistant' },
      { timestamp: '2026-02-27T10:00:06Z', sessionKey: 'sess-c', role: 'tool' },
    ]);

    const rows = getRangeTurnCountBySession(db, '2026-02-27T10:00:00Z', '2026-02-27T11:00:00Z');
    expect(rows).toEqual([
      { sessionKey: 'sess-b', turns: 3 },
      { sessionKey: 'sess-a', turns: 2 },
    ]);

    cleanup();
  });
});
