import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { initDatabase } from '../init';
import { insertTokenUsageEvent, insertTokenUsageEventBatch } from '../token-queries';

function setup() {
  const dbPath = join(tmpdir(), `tq-br-${Date.now()}-${Math.random()}.db`);
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

describe('insertTokenUsageEventBatch branches', () => {
  it('does nothing for empty array', () => {
    const { db, cleanup } = setup();
    insertTokenUsageEventBatch(db, []);
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM token_usage_events').get() as { cnt: number }).cnt;
    expect(count).toBe(0);
    cleanup();
  });

  it('inserts multiple events in a batch', () => {
    const { db, cleanup } = setup();
    insertTokenUsageEventBatch(db, [
      {
        timestamp: '2026-02-27T10:00:00Z',
        sessionKey: 'sess-1',
        model: 'claude-opus-4-6',
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 100,
        cacheWriteTokens: 50,
      },
      {
        timestamp: '2026-02-27T10:01:00Z',
        sessionKey: 'sess-2',
        model: 'gpt-5.3-codex',
        inputTokens: 2000,
        outputTokens: 800,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      },
    ]);
    const count = (db.prepare('SELECT COUNT(*) as cnt FROM token_usage_events').get() as { cnt: number }).cnt;
    expect(count).toBe(2);
    cleanup();
  });

  it('rolls back on error and rethrows', () => {
    const { db, cleanup } = setup();
    // Insert one event first
    insertTokenUsageEvent(db, {
      timestamp: '2026-02-27T10:00:00Z',
      sessionKey: 'sess-1',
      model: 'claude-opus-4-6',
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadTokens: 100,
      cacheWriteTokens: 50,
    });

    // Drop the table to force an error during batch insert
    db.exec('DROP TABLE token_usage_events');

    expect(() =>
      insertTokenUsageEventBatch(db, [
        {
          timestamp: '2026-02-27T10:01:00Z',
          sessionKey: 'sess-2',
          model: 'gpt-5.3-codex',
          inputTokens: 2000,
          outputTokens: 800,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        },
      ]),
    ).toThrow();
    cleanup();
  });
});
