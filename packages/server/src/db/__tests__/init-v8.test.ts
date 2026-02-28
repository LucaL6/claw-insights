import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { initDatabase } from '../init';

function setup() {
  const dbPath = join(tmpdir(), `init-v8-${Date.now()}-${Math.random()}.db`);
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

describe('initDatabase v8 migration', () => {
  it('creates message_events table and indexes', () => {
    const { db, cleanup } = setup();

    const columns = db.prepare('PRAGMA table_info(message_events)').all() as Array<{ name: string; notnull: number }>;
    expect(columns.map((c) => c.name)).toEqual(['id', 'timestamp', 'session_key', 'role', 'content_hash']);
    expect(columns.find((c) => c.name === 'timestamp')?.notnull).toBe(1);
    expect(columns.find((c) => c.name === 'session_key')?.notnull).toBe(1);
    expect(columns.find((c) => c.name === 'role')?.notnull).toBe(1);
    expect(columns.find((c) => c.name === 'content_hash')?.notnull).toBe(1);

    const indexes = db.prepare("PRAGMA index_list('message_events')").all() as Array<{ name: string }>;
    const indexNames = indexes.map((idx) => idx.name);
    expect(indexNames).toContain('idx_msg_events_time');
    expect(indexNames).toContain('idx_msg_events_session');

    const sessionIndexInfo = db.prepare("PRAGMA index_info('idx_msg_events_session')").all() as Array<{ name: string }>;
    expect(sessionIndexInfo.map((c) => c.name)).toEqual(['session_key', 'timestamp']);

    cleanup();
  });
});
