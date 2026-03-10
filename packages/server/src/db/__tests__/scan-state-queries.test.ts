import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Database } from '../database.js';
import { initDatabase } from '../init.js';
import {
  deleteScanState,
  loadScanState,
  queryLifetimeAggregates,
  queryMinFirstTimestamp,
  queryMissingFirstTimestampPaths,
  queryTotalSessionFiles,
  updateFirstTimestamps,
  upsertScanState,
} from '../scan-state-queries.js';

function tmpDb(): Database {
  const dir = join(tmpdir(), `scan-state-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  return initDatabase({ dbPath: join(dir, 'test.db') });
}

describe('scan-state-queries', () => {
  let db: Database;

  beforeEach(() => {
    db = tmpDb();
  });
  afterEach(() => {
    db.close();
  });

  describe('loadScanState', () => {
    it('returns empty map for fresh DB', () => {
      const state = loadScanState(db);
      expect(state.size).toBe(0);
    });

    it('returns saved entries', () => {
      upsertScanState(db, [
        {
          filePath: '/a.jsonl',
          byteOffset: 100,
          inode: 1,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: null,
        },
        {
          filePath: '/b.jsonl',
          byteOffset: 200,
          inode: 2,
          mtimeMs: 2000,
          birthMs: 600,
          partial: 'x',
          firstTimestampMs: null,
        },
      ]);
      const state = loadScanState(db);
      expect(state.size).toBe(2);
      expect(state.get('/a.jsonl')?.byteOffset).toBe(100);
      expect(state.get('/b.jsonl')?.partial).toBe('x');
    });
  });

  describe('upsertScanState', () => {
    it('updates existing entry on conflict', () => {
      upsertScanState(db, [
        {
          filePath: '/a.jsonl',
          byteOffset: 100,
          inode: 1,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: null,
        },
      ]);
      upsertScanState(db, [
        {
          filePath: '/a.jsonl',
          byteOffset: 500,
          inode: 1,
          mtimeMs: 2000,
          birthMs: 500,
          partial: 'p',
          firstTimestampMs: null,
        },
      ]);
      const state = loadScanState(db);
      expect(state.get('/a.jsonl')?.byteOffset).toBe(500);
      expect(state.get('/a.jsonl')?.mtimeMs).toBe(2000);
    });
  });

  describe('deleteScanState', () => {
    it('removes specified file paths', () => {
      upsertScanState(db, [
        {
          filePath: '/a.jsonl',
          byteOffset: 100,
          inode: 1,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: null,
        },
        {
          filePath: '/b.jsonl',
          byteOffset: 200,
          inode: 2,
          mtimeMs: 2000,
          birthMs: 600,
          partial: '',
          firstTimestampMs: null,
        },
      ]);
      deleteScanState(db, ['/a.jsonl']);
      const state = loadScanState(db);
      expect(state.size).toBe(1);
      expect(state.has('/a.jsonl')).toBe(false);
    });
  });

  describe('firstTimestampMs', () => {
    it('persists and loads firstTimestampMs', () => {
      upsertScanState(db, [
        {
          filePath: '/a.jsonl',
          byteOffset: 0,
          inode: 1,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: 1700000000000,
        },
      ]);
      const state = loadScanState(db);
      expect(state.get('/a.jsonl')?.firstTimestampMs).toBe(1700000000000);
    });

    it('loads null firstTimestampMs when not set', () => {
      upsertScanState(db, [
        {
          filePath: '/a.jsonl',
          byteOffset: 0,
          inode: 1,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: null,
        },
      ]);
      const state = loadScanState(db);
      expect(state.get('/a.jsonl')?.firstTimestampMs).toBeNull();
    });
  });

  describe('queryMinFirstTimestamp', () => {
    it('returns min across rows', () => {
      upsertScanState(db, [
        {
          filePath: '/a.jsonl',
          byteOffset: 0,
          inode: 1,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: 3000,
        },
        {
          filePath: '/b.jsonl',
          byteOffset: 0,
          inode: 2,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: 1000,
        },
        {
          filePath: '/c.jsonl',
          byteOffset: 0,
          inode: 3,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: 2000,
        },
      ]);
      expect(queryMinFirstTimestamp(db)).toBe(1000);
    });

    it('returns null when all rows have null', () => {
      upsertScanState(db, [
        {
          filePath: '/a.jsonl',
          byteOffset: 0,
          inode: 1,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: null,
        },
      ]);
      expect(queryMinFirstTimestamp(db)).toBeNull();
    });

    it('returns null for empty table', () => {
      expect(queryMinFirstTimestamp(db)).toBeNull();
    });
  });

  describe('upsertScanState inside caller transaction', () => {
    it('works inside caller transaction (re-entrant)', () => {
      db.transaction(() => {
        upsertScanState(db, [
          {
            filePath: '/a.jsonl',
            byteOffset: 100,
            inode: 1,
            mtimeMs: 1000,
            birthMs: 500,
            partial: '',
            firstTimestampMs: 5000,
          },
        ]);
      });
      const state = loadScanState(db);
      expect(state.get('/a.jsonl')?.byteOffset).toBe(100);
      expect(state.get('/a.jsonl')?.firstTimestampMs).toBe(5000);
    });
  });

  describe('queryMissingFirstTimestampPaths', () => {
    it('returns empty array when no rows', () => {
      expect(queryMissingFirstTimestampPaths(db)).toEqual([]);
    });

    it('returns paths where firstTimestampMs is null', () => {
      upsertScanState(db, [
        {
          filePath: '/a.jsonl',
          byteOffset: 0,
          inode: 1,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: null,
        },
        {
          filePath: '/b.jsonl',
          byteOffset: 0,
          inode: 2,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: 5000,
        },
        {
          filePath: '/c.jsonl',
          byteOffset: 0,
          inode: 3,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: null,
        },
      ]);
      const paths = queryMissingFirstTimestampPaths(db);
      expect(paths.sort()).toEqual(['/a.jsonl', '/c.jsonl']);
    });
  });

  describe('updateFirstTimestamps', () => {
    it('no-op for empty array', () => {
      updateFirstTimestamps(db, []);
      // no error thrown
    });

    it('updates first_timestamp_ms for given paths', () => {
      upsertScanState(db, [
        {
          filePath: '/a.jsonl',
          byteOffset: 0,
          inode: 1,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: null,
        },
        {
          filePath: '/b.jsonl',
          byteOffset: 0,
          inode: 2,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: null,
        },
      ]);
      updateFirstTimestamps(db, [{ path: '/a.jsonl', ts: 9999 }]);
      const state = loadScanState(db);
      expect(state.get('/a.jsonl')?.firstTimestampMs).toBe(9999);
      expect(state.get('/b.jsonl')?.firstTimestampMs).toBeNull();
    });
  });

  describe('queryTotalSessionFiles', () => {
    it('returns 0 for empty table', () => {
      expect(queryTotalSessionFiles(db)).toBe(0);
    });

    it('returns count of scan_state rows', () => {
      upsertScanState(db, [
        {
          filePath: '/a.jsonl',
          byteOffset: 0,
          inode: 1,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: null,
        },
        {
          filePath: '/b.jsonl',
          byteOffset: 0,
          inode: 2,
          mtimeMs: 1000,
          birthMs: 500,
          partial: '',
          firstTimestampMs: null,
        },
      ]);
      expect(queryTotalSessionFiles(db)).toBe(2);
    });
  });

  describe('upsertScanState edge cases', () => {
    it('no-op for empty array', () => {
      upsertScanState(db, []);
      expect(loadScanState(db).size).toBe(0);
    });
  });

  describe('deleteScanState edge cases', () => {
    it('no-op for empty array', () => {
      deleteScanState(db, []);
    });
  });

  describe('queryLifetimeAggregates', () => {
    it('returns zeros for empty DB', () => {
      const stats = queryLifetimeAggregates(db);
      expect(stats.totalInputTokens).toBe(0);
      expect(stats.totalOutputTokens).toBe(0);
      expect(stats.totalUserMessages).toBe(0);
      expect(stats.totalSessions).toBe(0);
    });

    it('sums token and message events correctly', () => {
      db.exec(`
        INSERT INTO token_usage_events (timestamp, session_key, model, input_tokens, output_tokens, cache_read, cache_write)
        VALUES ('2026-01-01T00:00:00Z', 'sess1', 'claude', 100, 200, 50, 25),
               ('2026-01-01T00:01:00Z', 'sess2', 'claude', 300, 400, 0, 0)
      `);
      db.exec(`
        INSERT INTO message_events (timestamp, session_key, role, content_hash)
        VALUES ('2026-01-01T00:00:00Z', 'sess1', 'user', 'h1'),
               ('2026-01-01T00:00:01Z', 'sess1', 'assistant', 'h2'),
               ('2026-01-01T00:00:02Z', 'sess2', 'user', 'h3')
      `);
      const stats = queryLifetimeAggregates(db);
      expect(stats.totalInputTokens).toBe(400);
      expect(stats.totalOutputTokens).toBe(600);
      expect(stats.totalCacheReadTokens).toBe(50);
      expect(stats.totalCacheWriteTokens).toBe(25);
      expect(stats.totalUserMessages).toBe(2);
      expect(stats.totalAssistantMessages).toBe(1);
      expect(stats.totalSessions).toBe(2);
    });
  });
});
