import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { initDatabase } from '../init.js';
import {
  getBucketedTurnCount,
  getBucketedTurnCountByRole,
  getRangeTurnCount,
  insertMessageEventBatch,
} from '../message-queries';

function setup() {
  const dbPath = join(tmpdir(), `mq-br-${Date.now()}-${Math.random()}.db`);
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

describe('insertMessageEventBatch branches', () => {
  it('does nothing for empty array', () => {
    const { db, cleanup } = setup();
    insertMessageEventBatch(db, []);
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM message_events').get() as { cnt: number }).cnt;
    expect(count).toBe(0);
    cleanup();
  });

  it('rolls back on error and rethrows', () => {
    const { db, cleanup } = setup();
    db.exec('DROP TABLE message_events');

    expect(() =>
      insertMessageEventBatch(db, [
        { timestamp: '2026-02-27T10:00:00Z', sessionKey: 'sess-1', role: 'user', lineHash: 'h1' },
      ]),
    ).toThrow();
    cleanup();
  });
});

describe('getRangeTurnCount branches', () => {
  it('returns 0 for empty range (row?.turns ?? 0)', () => {
    const { db, cleanup } = setup();
    const result = getRangeTurnCount(db, '2026-02-27T10:00:00Z', '2026-02-27T11:00:00Z');
    expect(result).toBe(0);
    cleanup();
  });
});

describe('getBucketedTurnCount', () => {
  it('returns bucketed turn counts', () => {
    const { db, cleanup } = setup();
    insertMessageEventBatch(db, [
      { timestamp: '2026-02-27T10:01:00Z', sessionKey: 'sess-1', role: 'user', lineHash: 'h1' },
      { timestamp: '2026-02-27T10:02:00Z', sessionKey: 'sess-1', role: 'assistant', lineHash: 'h2' },
      { timestamp: '2026-02-27T10:03:00Z', sessionKey: 'sess-1', role: 'tool', lineHash: 'h3' },
    ]);
    const result = getBucketedTurnCount(db, '2026-02-27T10:00:00Z', '2026-02-27T10:05:00Z', 5);
    expect(result.length).toBe(1);
    expect(result[0].turns).toBe(2); // only user+assistant
    cleanup();
  });
});

describe('getBucketedTurnCountByRole', () => {
  it('returns bucketed turn counts by role', () => {
    const { db, cleanup } = setup();
    insertMessageEventBatch(db, [
      { timestamp: '2026-02-27T10:01:00Z', sessionKey: 'sess-1', role: 'user', lineHash: 'h1' },
      { timestamp: '2026-02-27T10:02:00Z', sessionKey: 'sess-1', role: 'assistant', lineHash: 'h2' },
      { timestamp: '2026-02-27T10:03:00Z', sessionKey: 'sess-1', role: 'assistant', lineHash: 'h3' },
    ]);
    const result = getBucketedTurnCountByRole(db, '2026-02-27T10:00:00Z', '2026-02-27T10:05:00Z', 5);
    expect(result.length).toBe(2);
    const user = result.find((r) => r.role === 'user');
    const assistant = result.find((r) => r.role === 'assistant');
    expect(user?.turns).toBe(1);
    expect(assistant?.turns).toBe(2);
    cleanup();
  });
});

describe('getRangeTurnCount', () => {
  it('returns 0 when no messages exist in range', () => {
    const { db, cleanup } = setup();
    // Empty DB — exercises the row?.turns ?? 0 branch
    const result = getRangeTurnCount(db, '2030-01-01T00:00:00Z', '2030-01-02T00:00:00Z');
    expect(result).toBe(0);
    cleanup();
  });
});
