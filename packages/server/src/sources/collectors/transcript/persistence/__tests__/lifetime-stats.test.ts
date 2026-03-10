import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../../../../../db/database.js';

// Mock node:fs
vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  openSync: vi.fn(),
  readSync: vi.fn(),
  closeSync: vi.fn(),
}));

// Mock scan-state-queries
vi.mock('../../../../../db/scan-state-queries.js', () => ({
  queryLifetimeAggregates: vi.fn(),
  queryMinFirstTimestamp: vi.fn(),
  queryMissingFirstTimestampPaths: vi.fn(),
  queryTotalSessionFiles: vi.fn(),
  updateFirstTimestamps: vi.fn(),
}));

// Mock logger
vi.mock('../../../../../logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn() }),
}));

import { closeSync,existsSync, openSync, readFileSync, readSync } from 'node:fs';

import {
  queryLifetimeAggregates,
  queryMinFirstTimestamp,
  queryMissingFirstTimestampPaths,
  queryTotalSessionFiles,
  updateFirstTimestamps,
} from '../../../../../db/scan-state-queries.js';
import { backfillFirstTimestamps, computeStats,emptyStats, formatStats, resolveCreatedAt } from '../lifetime-stats.js';

const db = {} as Database;

describe('lifetime-stats', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  // ── emptyStats ──
  describe('emptyStats', () => {
    it('returns all zero fields', () => {
      const s = emptyStats();
      expect(s).toEqual({
        createdAtMs: 0,
        totalSessions: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCacheReadTokens: 0,
        totalCacheWriteTokens: 0,
        totalUserMessages: 0,
        totalAssistantMessages: 0,
      });
    });
  });

  // ── formatStats ──
  describe('formatStats', () => {
    it('uses createdAtMs when non-zero', () => {
      const now = Date.now();
      const created = now - 2 * 86400_000; // 2 days ago
      const result = formatStats(
        {
          ...emptyStats(),
          createdAtMs: created,
          totalInputTokens: 10,
          totalOutputTokens: 20,
          totalCacheReadTokens: 5,
          totalCacheWriteTokens: 3,
        },
        true,
      );
      expect(result.isReady).toBe(true);
      expect(result.createdAt).toBe(new Date(created).toISOString());
      expect(result.daysSinceCreation).toBe(2);
      expect(result.totalTokens).toBe(38);
    });

    it('falls back to now when createdAtMs is 0', () => {
      const now = Date.now();
      const result = formatStats(emptyStats(), false);
      expect(result.isReady).toBe(false);
      expect(result.createdAt).toBe(new Date(now).toISOString());
      expect(result.daysSinceCreation).toBe(0);
      expect(result.totalTokens).toBe(0);
    });
  });

  // ── resolveCreatedAt ──
  describe('resolveCreatedAt', () => {
    it('returns device.json createdAtMs when file exists and DB has no data', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ createdAtMs: 1000 }));
      vi.mocked(queryMinFirstTimestamp).mockReturnValue(null);
      expect(resolveCreatedAt(db, '/dev.json')).toBe(1000);
    });

    it('returns DB min when smaller than device', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ createdAtMs: 5000 }));
      vi.mocked(queryMinFirstTimestamp).mockReturnValue(2000);
      expect(resolveCreatedAt(db, '/dev.json')).toBe(2000);
    });

    it('returns device min when smaller than DB', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ createdAtMs: 1000 }));
      vi.mocked(queryMinFirstTimestamp).mockReturnValue(5000);
      expect(resolveCreatedAt(db, '/dev.json')).toBe(1000);
    });

    it('returns Date.now() when both missing', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(queryMinFirstTimestamp).mockReturnValue(null);
      expect(resolveCreatedAt(db, '/dev.json')).toBe(Date.now());
    });

    it('returns Date.now() when DB returns 0', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(queryMinFirstTimestamp).mockReturnValue(0);
      expect(resolveCreatedAt(db, '/dev.json')).toBe(Date.now());
    });

    it('handles device.json with non-number createdAtMs', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({ createdAtMs: 'bad' }));
      vi.mocked(queryMinFirstTimestamp).mockReturnValue(3000);
      expect(resolveCreatedAt(db, '/dev.json')).toBe(3000);
    });

    it('handles invalid JSON in device.json', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue('not json');
      vi.mocked(queryMinFirstTimestamp).mockReturnValue(null);
      // catch block fires, deviceMs stays Infinity, dbMin null → Date.now()
      expect(resolveCreatedAt(db, '/dev.json')).toBe(Date.now());
    });

    it('handles device.json missing (existsSync false) with valid DB', () => {
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(queryMinFirstTimestamp).mockReturnValue(4000);
      expect(resolveCreatedAt(db, '/dev.json')).toBe(4000);
    });

    it('handles device.json without createdAtMs key', () => {
      vi.mocked(existsSync).mockReturnValue(true);
      vi.mocked(readFileSync).mockReturnValue(JSON.stringify({}));
      vi.mocked(queryMinFirstTimestamp).mockReturnValue(null);
      expect(resolveCreatedAt(db, '/dev.json')).toBe(Date.now());
    });
  });

  // ── backfillFirstTimestamps ──
  describe('backfillFirstTimestamps', () => {
    it('returns early when no missing paths', () => {
      vi.mocked(queryMissingFirstTimestampPaths).mockReturnValue([]);
      backfillFirstTimestamps(db);
      expect(updateFirstTimestamps).not.toHaveBeenCalled();
    });

    it('reads and updates valid timestamps', () => {
      vi.mocked(queryMissingFirstTimestampPaths).mockReturnValue(['/a.jsonl']);
      vi.mocked(openSync).mockReturnValue(42);
      const jsonLine = JSON.stringify({ timestamp: '2025-01-01T00:00:00Z' }) + '\n';
      vi.mocked(readSync).mockImplementation((_fd: number, buf: ArrayBufferView) => {
        const bytes = Buffer.from(jsonLine);
        bytes.copy(buf as Buffer);
        return bytes.length;
      });
      vi.mocked(closeSync).mockReturnValue(undefined);

      backfillFirstTimestamps(db);
      expect(updateFirstTimestamps).toHaveBeenCalledWith(db, [
        { path: '/a.jsonl', ts: new Date('2025-01-01T00:00:00Z').getTime() },
      ]);
    });

    it('skips files that fail to open', () => {
      vi.mocked(queryMissingFirstTimestampPaths).mockReturnValue(['/bad.jsonl']);
      vi.mocked(openSync).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      backfillFirstTimestamps(db);
      expect(updateFirstTimestamps).not.toHaveBeenCalled();
    });

    it('skips files with 0 bytes read (empty file)', () => {
      vi.mocked(queryMissingFirstTimestampPaths).mockReturnValue(['/empty.jsonl']);
      vi.mocked(openSync).mockReturnValue(10);
      vi.mocked(readSync).mockReturnValue(0);
      vi.mocked(closeSync).mockReturnValue(undefined);

      backfillFirstTimestamps(db);
      expect(updateFirstTimestamps).not.toHaveBeenCalled();
    });

    it('skips lines with invalid JSON', () => {
      vi.mocked(queryMissingFirstTimestampPaths).mockReturnValue(['/bad-json.jsonl']);
      vi.mocked(openSync).mockReturnValue(10);
      vi.mocked(readSync).mockImplementation((_fd: number, buf: ArrayBufferView) => {
        const bytes = Buffer.from('not json\n');
        bytes.copy(buf as Buffer);
        return bytes.length;
      });
      vi.mocked(closeSync).mockReturnValue(undefined);

      backfillFirstTimestamps(db);
      expect(updateFirstTimestamps).not.toHaveBeenCalled();
    });

    it('skips lines with missing timestamp field', () => {
      vi.mocked(queryMissingFirstTimestampPaths).mockReturnValue(['/no-ts.jsonl']);
      vi.mocked(openSync).mockReturnValue(10);
      const line = JSON.stringify({ foo: 'bar' }) + '\n';
      vi.mocked(readSync).mockImplementation((_fd: number, buf: ArrayBufferView) => {
        const bytes = Buffer.from(line);
        bytes.copy(buf as Buffer);
        return bytes.length;
      });
      vi.mocked(closeSync).mockReturnValue(undefined);

      backfillFirstTimestamps(db);
      expect(updateFirstTimestamps).not.toHaveBeenCalled();
    });

    it('skips lines with non-string timestamp', () => {
      vi.mocked(queryMissingFirstTimestampPaths).mockReturnValue(['/num-ts.jsonl']);
      vi.mocked(openSync).mockReturnValue(10);
      const line = JSON.stringify({ timestamp: 12345 }) + '\n';
      vi.mocked(readSync).mockImplementation((_fd: number, buf: ArrayBufferView) => {
        const bytes = Buffer.from(line);
        bytes.copy(buf as Buffer);
        return bytes.length;
      });
      vi.mocked(closeSync).mockReturnValue(undefined);

      backfillFirstTimestamps(db);
      expect(updateFirstTimestamps).not.toHaveBeenCalled();
    });

    it('skips empty lines and finds timestamp in later line', () => {
      vi.mocked(queryMissingFirstTimestampPaths).mockReturnValue(['/with-blanks.jsonl']);
      vi.mocked(openSync).mockReturnValue(10);
      const content = '\n\n' + JSON.stringify({ timestamp: '2025-03-01T00:00:00Z' }) + '\n';
      vi.mocked(readSync).mockImplementation((_fd: number, buf: ArrayBufferView) => {
        const bytes = Buffer.from(content);
        bytes.copy(buf as Buffer);
        return bytes.length;
      });
      vi.mocked(closeSync).mockReturnValue(undefined);

      backfillFirstTimestamps(db);
      expect(updateFirstTimestamps).toHaveBeenCalledWith(db, [
        { path: '/with-blanks.jsonl', ts: new Date('2025-03-01T00:00:00Z').getTime() },
      ]);
    });

    it('skips timestamp that parses to NaN', () => {
      vi.mocked(queryMissingFirstTimestampPaths).mockReturnValue(['/bad-date.jsonl']);
      vi.mocked(openSync).mockReturnValue(10);
      const line = JSON.stringify({ timestamp: 'not-a-date' }) + '\n';
      vi.mocked(readSync).mockImplementation((_fd: number, buf: ArrayBufferView) => {
        const bytes = Buffer.from(line);
        bytes.copy(buf as Buffer);
        return bytes.length;
      });
      vi.mocked(closeSync).mockReturnValue(undefined);

      backfillFirstTimestamps(db);
      expect(updateFirstTimestamps).not.toHaveBeenCalled();
    });

    it('handles multiple paths with mixed results', () => {
      vi.mocked(queryMissingFirstTimestampPaths).mockReturnValue(['/good.jsonl', '/bad.jsonl']);
      vi.mocked(openSync).mockImplementation((path) => {
        if (path === '/bad.jsonl') {throw new Error('ENOENT');}
        return 10;
      });
      const goodLine = JSON.stringify({ timestamp: '2025-02-01T00:00:00Z' }) + '\n';
      vi.mocked(readSync).mockImplementation((_fd: number, buf: ArrayBufferView) => {
        const bytes = Buffer.from(goodLine);
        bytes.copy(buf as Buffer);
        return bytes.length;
      });
      vi.mocked(closeSync).mockReturnValue(undefined);

      backfillFirstTimestamps(db);
      expect(updateFirstTimestamps).toHaveBeenCalledWith(db, [
        { path: '/good.jsonl', ts: new Date('2025-02-01T00:00:00Z').getTime() },
      ]);
    });
  });

  // ── computeStats ──
  describe('computeStats', () => {
    it('combines all queries', () => {
      vi.mocked(queryLifetimeAggregates).mockReturnValue({
        totalInputTokens: 100,
        totalOutputTokens: 200,
        totalCacheReadTokens: 50,
        totalCacheWriteTokens: 25,
        totalUserMessages: 10,
        totalAssistantMessages: 8,
        totalSessions: 5,
      });
      vi.mocked(queryTotalSessionFiles).mockReturnValue(5);
      vi.mocked(existsSync).mockReturnValue(false);
      vi.mocked(queryMinFirstTimestamp).mockReturnValue(1000);

      const result = computeStats(db, '/dev.json');
      expect(result).toEqual({
        createdAtMs: 1000,
        totalSessions: 5,
        totalInputTokens: 100,
        totalOutputTokens: 200,
        totalCacheReadTokens: 50,
        totalCacheWriteTokens: 25,
        totalUserMessages: 10,
        totalAssistantMessages: 8,
      });
    });
  });
});
