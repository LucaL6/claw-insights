import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { initDatabase } from '../init.js';
import {
  getBucketedModelTokenUsage,
  getBucketedTokenUsage,
  getRangeModelTokenUsage,
  getRangeTokenUsageK,
  insertTokenUsageEvent,
} from '../token-queries';

function setup() {
  const dbPath = join(tmpdir(), `tq-${Date.now()}-${Math.random()}.db`);
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

describe('token-queries', () => {
  describe('insertTokenUsageEvent', () => {
    it('inserts a token usage event', () => {
      const { db, cleanup } = setup();
      insertTokenUsageEvent(db, {
        timestamp: '2026-02-27T10:00:00Z',
        sessionKey: 'sess-1',
        model: 'claude-opus-4-6',
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 100,
        cacheWriteTokens: 50,
      });
      const row = db.prepare('SELECT * FROM token_usage_events').get() as Record<string, unknown>;
      expect(row.input_tokens).toBe(1000);
      expect(row.output_tokens).toBe(500);
      expect(row.session_key).toBe('sess-1');
      cleanup();
    });

    it('ignores duplicate (same timestamp + session_key + model)', () => {
      const { db, cleanup } = setup();
      const event = {
        timestamp: '2026-02-27T10:00:00Z',
        sessionKey: 'sess-1',
        model: 'claude-opus-4-6',
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      };
      insertTokenUsageEvent(db, event);
      insertTokenUsageEvent(db, { ...event, inputTokens: 9999 });

      const count = (db.prepare('SELECT COUNT(*) as cnt FROM token_usage_events').get() as { cnt: number }).cnt;
      expect(count).toBe(1);
      cleanup();
    });
  });

  describe('getBucketedTokenUsage', () => {
    it('returns bucketed token sums', () => {
      const { db, cleanup } = setup();
      insertTokenUsageEvent(db, {
        timestamp: '2026-02-27T10:01:00Z',
        sessionKey: 'sess-1',
        model: 'claude-opus-4-6',
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 100,
        cacheWriteTokens: 50,
      });
      insertTokenUsageEvent(db, {
        timestamp: '2026-02-27T10:02:00Z',
        sessionKey: 'sess-1',
        model: 'claude-opus-4-6',
        inputTokens: 2000,
        outputTokens: 1000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });

      const result = getBucketedTokenUsage(db, '2026-02-27T10:00:00Z', '2026-02-27T10:05:00Z', 5);
      expect(result.length).toBe(1);
      // (1000+500+100+50 + 2000+1000+0+0) / 1000 = 4.65
      expect(result[0].tokensK).toBeCloseTo(4.65, 2);
      cleanup();
    });
  });

  describe('getBucketedModelTokenUsage', () => {
    it('groups by model within buckets', () => {
      const { db, cleanup } = setup();
      insertTokenUsageEvent(db, {
        timestamp: '2026-02-27T10:01:00Z',
        sessionKey: 'sess-1',
        model: 'claude-opus-4-6',
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      insertTokenUsageEvent(db, {
        timestamp: '2026-02-27T10:02:00Z',
        sessionKey: 'sess-2',
        model: 'gpt-5.3-codex',
        inputTokens: 2000,
        outputTokens: 800,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });

      const result = getBucketedModelTokenUsage(db, '2026-02-27T10:00:00Z', '2026-02-27T10:05:00Z', 5);
      expect(result.length).toBe(2);
      const opus = result.find((r) => r.model === 'claude-opus-4-6');
      const codex = result.find((r) => r.model === 'gpt-5.3-codex');
      expect(opus?.tokensK).toBeCloseTo(1.5, 2);
      expect(codex?.tokensK).toBeCloseTo(2.8, 2);
      cleanup();
    });
  });

  describe('getRangeTokenUsageK', () => {
    it('returns total tokens in range', () => {
      const { db, cleanup } = setup();
      insertTokenUsageEvent(db, {
        timestamp: '2026-02-27T10:01:00Z',
        sessionKey: 'sess-1',
        model: 'claude-opus-4-6',
        inputTokens: 5000,
        outputTokens: 2000,
        cacheReadTokens: 500,
        cacheWriteTokens: 200,
      });

      const result = getRangeTokenUsageK(db, '2026-02-27T10:00:00Z', '2026-02-27T11:00:00Z');
      expect(result).toBeCloseTo(7.7, 2);
      cleanup();
    });

    it('returns 0 for empty range', () => {
      const { db, cleanup } = setup();
      const result = getRangeTokenUsageK(db, '2026-02-27T10:00:00Z', '2026-02-27T11:00:00Z');
      expect(result).toBe(0);
      cleanup();
    });
  });

  describe('getRangeModelTokenUsage', () => {
    it('returns token totals grouped by model in descending order', () => {
      const { db, cleanup } = setup();
      insertTokenUsageEvent(db, {
        timestamp: '2026-02-27T10:01:00Z',
        sessionKey: 'sess-1',
        model: 'gpt-5.3-codex',
        inputTokens: 3000,
        outputTokens: 1000,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
      insertTokenUsageEvent(db, {
        timestamp: '2026-02-27T10:02:00Z',
        sessionKey: 'sess-2',
        model: 'claude-opus-4-6',
        inputTokens: 1000,
        outputTokens: 500,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });

      const result = getRangeModelTokenUsage(db, '2026-02-27T10:00:00Z', '2026-02-27T11:00:00Z');
      expect(result).toEqual([
        { model: 'gpt-5.3-codex', tokensK: 4 },
        { model: 'claude-opus-4-6', tokensK: 1.5 },
      ]);
      cleanup();
    });

    it('returns empty array for empty range', () => {
      const { db, cleanup } = setup();
      const result = getRangeModelTokenUsage(db, '2026-02-27T10:00:00Z', '2026-02-27T11:00:00Z');
      expect(result).toEqual([]);
      cleanup();
    });

    it('returns one row for a single model', () => {
      const { db, cleanup } = setup();
      insertTokenUsageEvent(db, {
        timestamp: '2026-02-27T10:01:00Z',
        sessionKey: 'sess-1',
        model: 'claude-opus-4-6',
        inputTokens: 2000,
        outputTokens: 1000,
        cacheReadTokens: 500,
        cacheWriteTokens: 500,
      });

      const result = getRangeModelTokenUsage(db, '2026-02-27T10:00:00Z', '2026-02-27T11:00:00Z');
      expect(result).toEqual([{ model: 'claude-opus-4-6', tokensK: 4 }]);
      cleanup();
    });
  });
});
