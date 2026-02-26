import type { DatabaseSync as Database } from 'node:sqlite';

import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getBucketedEventCount, insertEvent } from '../event-queries';
import { initDatabase } from '../init';
import { bucketLabel } from '../query-utils';

const dbPath = join(tmpdir(), `test-metrics-${Date.now()}.db`);
let db: Database;

beforeEach(() => {
  db = initDatabase(dbPath);
});

afterEach(() => {
  db.close();
  rmSync(dbPath, { force: true });
  rmSync(dbPath + '-wal', { force: true });
  rmSync(dbPath + '-shm', { force: true });
});

describe('SQLite DB', () => {
  it('should create tables and indexes', () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='metric_events'").all();
    expect(tables.length).toBe(1);

    const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_events%'").all();
    expect(indexes.length).toBe(4); // idx_events_type_time, idx_events_time, idx_events_module (migration 2), idx_events_category (migration 3)
  });

  it('should insert events', () => {
    insertEvent(db, 'error', null, { module: 'tools', message: 'exec failed' });
    insertEvent(db, 'error', null, { module: 'agent', message: 'timeout' });
    insertEvent(db, 'warning', null, { module: 'tools', message: 'slow' });

    const row = db.prepare("SELECT COUNT(*) as cnt FROM metric_events WHERE type='error'").get() as { cnt: number };
    expect(row.cnt).toBe(2);
  });

  it('should create system_samples table', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='system_samples'").get() as {
      name: string;
    } | null;
    expect(row).not.toBeNull();
    expect(row!.name).toBe('system_samples');
  });

  it('should insert and query system samples', () => {
    db.prepare(`INSERT INTO system_samples (timestamp, active_sessions, cpu, memory_mb) VALUES (?, ?, ?, ?)`).run(
      '2026-02-15T10:00:00Z',
      5,
      12.5,
      256,
    );
    const row = db.prepare('SELECT * FROM system_samples ORDER BY id DESC LIMIT 1').get() as Record<string, unknown>;
    expect(row.active_sessions).toBe(5);
    expect(row.cpu).toBe(12.5);
    expect(row.memory_mb).toBe(256);
  });

  it('should insert events with category and source', () => {
    insertEvent(db, 'error', null, { module: 'test', message: 'boom' });
    const row = db
      .prepare("SELECT category, source FROM metric_events WHERE type='error' ORDER BY id DESC LIMIT 1")
      .get() as { category: string; source: string };
    expect(row.category).toBe('severity.error');
    expect(row.source).toBe('openclaw');
  });

  it('should insert unknown event type with uncategorized fallback', () => {
    insertEvent(db, 'custom_thing', null, {});
    const row = db.prepare("SELECT category, source FROM metric_events WHERE type='custom_thing'").get() as {
      category: string;
      source: string;
    };
    expect(row.category).toBe('uncategorized');
    expect(row.source).toBe('unknown');
  });
});

function setup() {
  const p = join(tmpdir(), `test-bucket-${Date.now()}-${Math.random()}.db`);
  const d = initDatabase(p);
  return {
    db: d,
    cleanup: () => {
      d.close();
      rmSync(p, { force: true });
      rmSync(p + '-wal', { force: true });
      rmSync(p + '-shm', { force: true });
    },
  };
}

describe('Epoch bucket functions', () => {
  it('bucketLabel should convert epoch bucket to local HH:MM', () => {
    const epochSec = Math.floor(new Date('2026-02-16T09:00:00Z').getTime() / 1000);
    const bucket5 = Math.floor(epochSec / 300);
    const label = bucketLabel(bucket5, 5);
    expect(label).toMatch(/^\d{1,2}:\d{2}$/);

    const bucket60 = Math.floor(epochSec / 3600);
    const label60 = bucketLabel(bucket60, 60);
    expect(label60).toMatch(/^\d{1,2}:00$/);
  });

  it('bucketLabel should produce consecutive labels for consecutive buckets', () => {
    const epochSec = Math.floor(new Date('2026-02-16T09:00:00Z').getTime() / 1000);
    const baseBucket = Math.floor(epochSec / 300);
    const label0 = bucketLabel(baseBucket, 5);
    const label1 = bucketLabel(baseBucket + 1, 5);
    const label2 = bucketLabel(baseBucket + 2, 5);
    const min = (l: string) => {
      const [h, m] = l.split(':').map(Number);
      return h * 60 + m;
    };
    expect(min(label1) - min(label0)).toBe(5);
    expect(min(label2) - min(label1)).toBe(5);
  });
});

describe('Cross-day bucket isolation', () => {
  it('should NOT merge same time-of-day from different days into one bucket', () => {
    const { db: testDb, cleanup } = setup();
    const day1 = '2026-02-15T14:30:00.000Z';
    const day2 = '2026-02-16T14:30:00.000Z';
    testDb
      .prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)')
      .run(day1, 'error', null, null);
    testDb
      .prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)')
      .run(day2, 'error', null, null);

    const results = getBucketedEventCount(testDb, day1, '2026-02-16T15:00:00.000Z', 'error', 60);
    expect(results.length).toBe(2);
    expect(results[0].count).toBe(1);
    expect(results[1].count).toBe(1);
    cleanup();
  });

  it('should produce ascending bucket numbers for cross-midnight data', () => {
    const { db: testDb, cleanup } = setup();
    testDb
      .prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)')
      .run('2026-02-15T23:30:00.000Z', 'error', null, null);
    testDb
      .prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)')
      .run('2026-02-16T00:30:00.000Z', 'error', null, null);

    const results = getBucketedEventCount(testDb, '2026-02-15T23:00:00.000Z', '2026-02-16T01:00:00.000Z', 'error', 60);
    expect(results.length).toBe(2);
    expect(results[1].bucket).toBeGreaterThan(results[0].bucket);
    cleanup();
  });
});
