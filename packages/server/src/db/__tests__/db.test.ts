import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDatabase } from '../init';
import { insertEvent, getRecentEvents, getSpawnEvents, insertSample, getBucketedEventCount, getBucketedSampledSessions, getBucketedSampledTokens, bucketLabel } from '../queries';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { DatabaseSync as Database } from 'node:sqlite';

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

  it('should insert and query events', () => {
    insertEvent(db, 'error', null, { module: 'tools', message: 'exec failed' });
    insertEvent(db, 'error', null, { module: 'agent', message: 'timeout' });
    insertEvent(db, 'warning', null, { module: 'tools', message: 'slow' });

    const recent = getRecentEvents(db, 'error', 10);
    expect(recent.length).toBe(2);
  });

  it('should query recent events', () => {
    insertEvent(db, 'error', null, { message: 'first' });
    insertEvent(db, 'error', null, { message: 'second' });
    insertEvent(db, 'error', null, { message: 'third' });

    const recent = getRecentEvents(db, 'error', 2);
    expect(recent.length).toBe(2);
  });

  it('should create metric_samples table', () => {
    const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='metric_samples'").get() as { name: string } | null;
    expect(row).not.toBeNull();
    expect(row!.name).toBe('metric_samples');
  });

  it('should insert and query metric samples', () => {
    db.prepare(`INSERT INTO metric_samples (timestamp, active_sessions, total_tokens_k, token_delta_k, cost_today, tokens_today_m, cpu, memory_mb) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
      '2026-02-15T10:00:00Z', 5, 120.5, 3.2, 45.50, 62.3, 12.5, 256
    );
    const row = db.prepare('SELECT * FROM metric_samples ORDER BY id DESC LIMIT 1').get() as Record<string, unknown>;
    expect(row.active_sessions).toBe(5);
    expect(row.total_tokens_k).toBe(120.5);
    expect(row.token_delta_k).toBe(3.2);
    expect(row.cost_today).toBe(45.50);
  });

  it('should query spawn events', () => {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)').run(
      now, 'spawn_agent', null,
      JSON.stringify({ parentKey: 'agent:main:parent', childKey: 'agent:main:child', runId: 'abc123' })
    );

    const today = new Date().toISOString().split('T')[0];
    const spawns = getSpawnEvents(db, today);
    expect(spawns.length).toBe(1);
    expect(spawns[0].parentKey).toBe('agent:main:parent');
    expect(spawns[0].childKey).toBe('agent:main:child');
  });

  it('should insert events with category and source', () => {
    insertEvent(db, 'error', null, { module: 'test', message: 'boom' });
    const row = db.prepare("SELECT category, source FROM metric_events WHERE type='error' ORDER BY id DESC LIMIT 1").get() as { category: string; source: string };
    expect(row.category).toBe('severity.error');
    expect(row.source).toBe('openclaw');
  });

  it('should insert unknown event type with uncategorized fallback', () => {
    insertEvent(db, 'custom_thing', null, {});
    const row = db.prepare("SELECT category, source FROM metric_events WHERE type='custom_thing'").get() as { category: string; source: string };
    expect(row.category).toBe('uncategorized');
    expect(row.source).toBe('unknown');
  });

});

function setup() {
  const p = join(tmpdir(), `test-bucket-${Date.now()}-${Math.random()}.db`);
  const d = initDatabase(p);
  return { db: d, cleanup: () => { d.close(); rmSync(p, { force: true }); rmSync(p + '-wal', { force: true }); rmSync(p + '-shm', { force: true }); } };
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
    testDb.prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)').run(day1, 'error', null, null);
    testDb.prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)').run(day2, 'error', null, null);

    const results = getBucketedEventCount(testDb, day1, '2026-02-16T15:00:00.000Z', 'error', 60);
    expect(results.length).toBe(2);
    expect(results[0].count).toBe(1);
    expect(results[1].count).toBe(1);
    cleanup();
  });

  it('should produce ascending bucket numbers for cross-midnight data', () => {
    const { db: testDb, cleanup } = setup();
    testDb.prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)').run('2026-02-15T23:30:00.000Z', 'error', null, null);
    testDb.prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)').run('2026-02-16T00:30:00.000Z', 'error', null, null);

    const results = getBucketedEventCount(testDb, '2026-02-15T23:00:00.000Z', '2026-02-16T01:00:00.000Z', 'error', 60);
    expect(results.length).toBe(2);
    expect(results[1].bucket).toBeGreaterThan(results[0].bucket);
    cleanup();
  });
});
