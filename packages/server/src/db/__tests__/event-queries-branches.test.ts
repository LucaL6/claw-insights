import { DatabaseSync as Database } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { mapEvent } from '../../sources/events-mapper.js';
import { getBucketedEventCount, insertEvent, queryEvents } from '../event-queries.js';

function setupDb(): Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE metric_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      value REAL,
      metadata TEXT,
      category TEXT,
      source TEXT
    );
    CREATE INDEX idx_events_type_time ON metric_events(type, timestamp);
  `);
  return db;
}

function insertRow(db: Database, type: string, ts: string, metadata?: Record<string, unknown>) {
  const { category, source } = mapEvent(type);
  db.prepare(
    'INSERT INTO metric_events (timestamp, type, value, metadata, category, source) VALUES (?, ?, ?, ?, ?, ?)',
  ).run(ts, type, null, metadata ? JSON.stringify(metadata) : null, category, source);
}

describe('queryEvents branches', () => {
  it('parses JSON message that is a JSON object', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T10:00:00Z', { message: '{"key":"val","num":42}' });
    const result = queryEvents(db, {});
    expect(result.events[0].message).toBe('key: val, num: 42');
  });

  it('keeps original message when JSON parse fails', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T10:00:00Z', { message: '{invalid json}' });
    const result = queryEvents(db, {});
    expect(result.events[0].message).toBe('{invalid json}');
  });

  it('handles message without metadata', () => {
    const db = setupDb();
    db.prepare(
      'INSERT INTO metric_events (timestamp, type, value, metadata, category, source) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('2026-01-01T10:00:00Z', 'error', null, null, 'severity.error', 'system');
    const result = queryEvents(db, {});
    expect(result.events[0].message).toBe('');
  });

  it('handles from/to filter', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T10:00:00Z', { message: 'e1' });
    insertRow(db, 'error', '2026-01-01T11:00:00Z', { message: 'e2' });
    const from = Math.floor(new Date('2026-01-01T10:30:00Z').getTime() / 1000);
    const to = Math.floor(new Date('2026-01-01T12:00:00Z').getTime() / 1000);
    const result = queryEvents(db, { from, to });
    expect(result.events.length).toBe(1);
    expect(result.events[0].message).toBe('e2');
  });

  it('counts warnings and restarts', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T10:00:00Z', { message: 'e' });
    insertRow(db, 'warning', '2026-01-01T10:01:00Z', { message: 'w' });
    insertRow(db, 'gateway_restart', '2026-01-01T10:02:00Z', { message: 'r' });
    const result = queryEvents(db, {});
    expect(result.counts.error).toBe(1);
    expect(result.counts.warning).toBe(1);
    expect(result.counts.restart).toBe(1);
  });
});

describe('getBucketedEventCount branches', () => {
  it('uses category fallback for mapped events', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T10:00:00Z');
    const result = getBucketedEventCount(db, '2026-01-01T09:00:00Z', '2026-01-01T11:00:00Z', 'error', 60);
    expect(result.length).toBeGreaterThan(0);
  });

  it('uses direct type match for unmapped events', () => {
    const db = setupDb();
    db.prepare(
      'INSERT INTO metric_events (timestamp, type, value, metadata, category, source) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('2026-01-01T10:00:00Z', 'custom_event', null, null, null, null);
    const result = getBucketedEventCount(db, '2026-01-01T09:00:00Z', '2026-01-01T11:00:00Z', 'custom_event', 60);
    expect(result.length).toBe(1);
  });
});

describe('insertEvent', () => {
  it('inserts event with metadata', () => {
    const db = setupDb();
    insertEvent(db, 'error', 1, { message: 'test' });
    const row = db.prepare('SELECT * FROM metric_events').get() as Record<string, unknown>;
    expect(row.type).toBe('error');
    expect(row.metadata).toContain('test');
  });

  it('inserts event without value or metadata', () => {
    const db = setupDb();
    insertEvent(db, 'warning');
    const row = db.prepare('SELECT * FROM metric_events').get() as Record<string, unknown>;
    expect(row.type).toBe('warning');
    expect(row.value).toBeNull();
    expect(row.metadata).toBeNull();
  });
});
