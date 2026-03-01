import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { initDatabase } from '../init.js';
import {
  deleteAllMessageEvents,
  getRangeTurnCount,
  getRangeTurnCountBySession,
  insertMessageEvent,
  insertMessageEventBatch,
} from '../message-queries';

function setup() {
  const dbPath = join(tmpdir(), `mq-${Date.now()}-${Math.random()}.db`);
  const db = initDatabase({ dbPath });
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
      lineHash: 'a1b2c3d4',
    });

    const row = db.prepare('SELECT timestamp, session_key, role, content_hash FROM message_events').get() as {
      timestamp: string;
      session_key: string;
      role: string;
      content_hash: string;
    };
    expect(row.timestamp).toBe('2026-02-27T10:00:00Z');
    expect(row.session_key).toBe('sess-1');
    expect(row.role).toBe('user');
    expect(row.content_hash).toHaveLength(16);

    cleanup();
  });

  it('insertMessageEventBatch inserts rows in one transaction path', () => {
    const { db, cleanup } = setup();

    insertMessageEventBatch(db, [
      { timestamp: '2026-02-27T10:00:00Z', sessionKey: 'sess-1', role: 'user', lineHash: 'a1b2c3d4' },
      { timestamp: '2026-02-27T10:00:01Z', sessionKey: 'sess-1', role: 'assistant', lineHash: 'b2c3d4e5' },
      { timestamp: '2026-02-27T10:00:02Z', sessionKey: 'sess-2', role: 'tool', lineHash: 'c3d4e5f6' },
    ]);

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;
    expect(count).toBe(3);

    const hashes = db.prepare('SELECT content_hash FROM message_events').all() as Array<{ content_hash: string }>;
    expect(hashes.every((h) => typeof h.content_hash === 'string' && h.content_hash.length === 16)).toBe(true);

    cleanup();
  });

  it('insertMessageEvent ignores duplicate rows', () => {
    const { db, cleanup } = setup();

    const event = { timestamp: '2026-02-27T10:00:00Z', sessionKey: 'sess-dup', role: 'user', lineHash: 'd4e5f6a1' };
    insertMessageEvent(db, event);
    insertMessageEvent(db, event);

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;
    expect(count).toBe(1);

    cleanup();
  });

  it('inserts both events when same ts/session/role but different lineHash', () => {
    const { db, cleanup } = setup();

    insertMessageEvent(db, {
      timestamp: '2026-02-27T10:00:00Z',
      sessionKey: 'sess-1',
      role: 'tool',
      lineHash: 'aaaa1111',
    });
    insertMessageEvent(db, {
      timestamp: '2026-02-27T10:00:00Z',
      sessionKey: 'sess-1',
      role: 'tool',
      lineHash: 'bbbb2222',
    });

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;
    expect(count).toBe(2);

    cleanup();
  });

  it('insertMessageEventBatch inserts only unique rows for mixed duplicates', () => {
    const { db, cleanup } = setup();

    insertMessageEventBatch(db, [
      { timestamp: '2026-02-27T10:00:00Z', sessionKey: 'sess-1', role: 'user', lineHash: 'a1b2c3d4' },
      { timestamp: '2026-02-27T10:00:00Z', sessionKey: 'sess-1', role: 'user', lineHash: 'a1b2c3d4' },
      { timestamp: '2026-02-27T10:00:01Z', sessionKey: 'sess-1', role: 'assistant', lineHash: 'b2c3d4e5' },
      { timestamp: '2026-02-27T10:00:01Z', sessionKey: 'sess-1', role: 'assistant', lineHash: 'b2c3d4e5' },
      { timestamp: '2026-02-27T10:00:02Z', sessionKey: 'sess-2', role: 'tool', lineHash: 'c3d4e5f6' },
    ]);

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;
    expect(count).toBe(3);

    cleanup();
  });

  it('getRangeTurnCount counts only user+assistant turns in range', () => {
    const { db, cleanup } = setup();

    insertMessageEventBatch(db, [
      { timestamp: '2026-02-27T09:59:59Z', sessionKey: 'sess-1', role: 'user', lineHash: 'a1b2c3d4' },
      { timestamp: '2026-02-27T10:00:00Z', sessionKey: 'sess-1', role: 'user', lineHash: 'a1b2c3d4' },
      { timestamp: '2026-02-27T10:00:01Z', sessionKey: 'sess-1', role: 'assistant', lineHash: 'b2c3d4e5' },
      { timestamp: '2026-02-27T10:00:02Z', sessionKey: 'sess-1', role: 'tool', lineHash: 'd1d1d1d1' },
      { timestamp: '2026-02-27T10:00:03Z', sessionKey: 'sess-2', role: 'assistant', lineHash: 'e1e1e1e1' },
      { timestamp: '2026-02-27T10:10:00Z', sessionKey: 'sess-2', role: 'user', lineHash: 'f1f1f1f1' },
    ]);

    const turns = getRangeTurnCount(db, '2026-02-27T10:00:00Z', '2026-02-27T10:10:00Z');
    expect(turns).toBe(3);

    cleanup();
  });

  it('getRangeTurnCount returns 0 for empty range', () => {
    const { db, cleanup } = setup();
    const turns = getRangeTurnCount(db, '2099-01-01T00:00:00Z', '2099-01-02T00:00:00Z');
    expect(turns).toBe(0);
    cleanup();
  });

  it('deleteAllMessageEvents removes all rows', () => {
    const { db, cleanup } = setup();

    insertMessageEventBatch(db, [
      { timestamp: '2026-02-27T10:00:00Z', sessionKey: 'sess-a', role: 'user', lineHash: 'e5f6a1b2' },
      { timestamp: '2026-02-27T10:00:01Z', sessionKey: 'sess-a', role: 'assistant', lineHash: 'f6a1b2c3' },
    ]);

    deleteAllMessageEvents(db);

    const count = (db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;
    expect(count).toBe(0);

    cleanup();
  });

  it('getRangeTurnCountBySession groups and orders by turns desc', () => {
    const { db, cleanup } = setup();

    insertMessageEventBatch(db, [
      { timestamp: '2026-02-27T10:00:00Z', sessionKey: 'sess-a', role: 'user', lineHash: 'e5f6a1b2' },
      { timestamp: '2026-02-27T10:00:01Z', sessionKey: 'sess-a', role: 'assistant', lineHash: 'f6a1b2c3' },
      { timestamp: '2026-02-27T10:00:02Z', sessionKey: 'sess-a', role: 'tool', lineHash: 'a1a1a1a1' },
      { timestamp: '2026-02-27T10:00:03Z', sessionKey: 'sess-b', role: 'user', lineHash: 'b1b1b1b1' },
      { timestamp: '2026-02-27T10:00:04Z', sessionKey: 'sess-b', role: 'assistant', lineHash: 'b2b2b2b2' },
      { timestamp: '2026-02-27T10:00:05Z', sessionKey: 'sess-b', role: 'assistant', lineHash: 'b3b3b3b3' },
      { timestamp: '2026-02-27T10:00:06Z', sessionKey: 'sess-c', role: 'tool', lineHash: 'c1c1c1c1' },
    ]);

    const rows = getRangeTurnCountBySession(db, '2026-02-27T10:00:00Z', '2026-02-27T11:00:00Z');
    expect(rows).toEqual([
      { sessionKey: 'sess-b', turns: 3 },
      { sessionKey: 'sess-a', turns: 2 },
    ]);

    cleanup();
  });
});
