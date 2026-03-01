import { DatabaseSync as Database } from 'node:sqlite';

import { describe, expect, it } from 'vitest';

import { mapEvent } from '../../sources/events-mapper.js';
import { getBucketedGatewayEvents, getEventCounts, getEventDensity, queryEvents } from '../event-queries.js';

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

describe('queryEvents — branch coverage', () => {
  it('empty types array skips IN clause', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T10:00:00Z', { message: 'e1' });
    insertRow(db, 'custom_thing', '2026-01-01T10:01:00Z', { message: 'c1' });
    // empty types → no type filter, returns all
    const result = queryEvents(db, { types: [] });
    expect(result.events.length).toBe(2);
    expect(result.total).toBe(2);
  });

  it('from only (no to)', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T08:00:00Z');
    insertRow(db, 'error', '2026-01-01T12:00:00Z');
    const from = Math.floor(new Date('2026-01-01T10:00:00Z').getTime() / 1000);
    const result = queryEvents(db, { from });
    expect(result.events.length).toBe(1);
  });

  it('to only (no from)', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T08:00:00Z');
    insertRow(db, 'error', '2026-01-01T12:00:00Z');
    const to = Math.floor(new Date('2026-01-01T10:00:00Z').getTime() / 1000);
    const result = queryEvents(db, { to });
    expect(result.events.length).toBe(1);
  });

  it('neither from nor to', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T10:00:00Z');
    const result = queryEvents(db, {});
    expect(result.events.length).toBe(1);
  });

  it('category-based counting (severity.error via category, not type)', () => {
    const db = setupDb();
    // Insert a row where type != 'error' but category = 'severity.error'
    db.prepare(
      'INSERT INTO metric_events (timestamp, type, value, metadata, category, source) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('2026-01-01T10:00:00Z', 'some_error', null, null, 'severity.error', 'system');
    // And one with category = 'severity.warning'
    db.prepare(
      'INSERT INTO metric_events (timestamp, type, value, metadata, category, source) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('2026-01-01T10:01:00Z', 'some_warn', null, null, 'severity.warning', 'system');
    // And one with category = 'lifecycle.restart'
    db.prepare(
      'INSERT INTO metric_events (timestamp, type, value, metadata, category, source) VALUES (?, ?, ?, ?, ?, ?)',
    ).run('2026-01-01T10:02:00Z', 'some_restart', null, null, 'lifecycle.restart', 'system');

    // Query with types that match categories
    const result = queryEvents(db, { types: ['severity.error', 'severity.warning', 'lifecycle.restart'] });
    expect(result.counts.error).toBe(1);
    expect(result.counts.warning).toBe(1);
    expect(result.counts.restart).toBe(1);
  });

  it('message that is not a JSON object (no curly braces)', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T10:00:00Z', { message: 'plain text', module: 'mymod' });
    const result = queryEvents(db, {});
    expect(result.events[0].message).toBe('plain text');
    expect(result.events[0].module).toBe('mymod');
  });
});

describe('getEventCounts — branch coverage', () => {
  it('with both from and to', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T10:00:00Z');
    insertRow(db, 'warning', '2026-01-01T12:00:00Z');
    const from = Math.floor(new Date('2026-01-01T09:00:00Z').getTime() / 1000);
    const to = Math.floor(new Date('2026-01-01T11:00:00Z').getTime() / 1000);
    const result = getEventCounts(db, { from, to });
    expect(result.error).toBe(1);
    expect(result.warning).toBe(0);
  });

  it('with from only', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T10:00:00Z');
    const from = Math.floor(new Date('2026-01-01T09:00:00Z').getTime() / 1000);
    const result = getEventCounts(db, { from });
    expect(result.error).toBe(1);
  });

  it('with to only', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T10:00:00Z');
    const to = Math.floor(new Date('2026-01-01T11:00:00Z').getTime() / 1000);
    const result = getEventCounts(db, { to });
    expect(result.error).toBe(1);
  });

  it('with neither from nor to', () => {
    const db = setupDb();
    insertRow(db, 'warning', '2026-01-01T10:00:00Z');
    const result = getEventCounts(db, {});
    expect(result.warning).toBe(1);
    expect(result.error).toBe(0);
  });

  it('empty table returns zeros', () => {
    const db = setupDb();
    const result = getEventCounts(db, {});
    expect(result).toEqual({ error: 0, warning: 0, restart: 0 });
  });
});

describe('getEventDensity — branch coverage', () => {
  it('returns 24 buckets with mix of populated and empty', () => {
    const db = setupDb();
    // Insert an event within the last hour so at least one bucket has data
    const now = new Date();
    insertRow(db, 'error', now.toISOString());
    insertRow(db, 'warning', now.toISOString());
    insertRow(db, 'gateway_restart', now.toISOString());

    const result = getEventDensity(db);
    expect(result).toHaveLength(24);

    // Most buckets should be empty (count=0), at least one should have data
    const populated = result.filter((b) => b.count > 0);
    expect(populated.length).toBeGreaterThan(0);

    const empty = result.filter((b) => b.count === 0);
    expect(empty.length).toBeGreaterThan(0);
    // Empty buckets exercise the row?.cnt ?? 0 fallback
    expect(empty[0].count).toBe(0);
    expect(empty[0].hasError).toBe(false);
    expect(empty[0].hasWarning).toBe(false);
    expect(empty[0].hasRestart).toBe(false);

    // Populated bucket
    const p = populated[0];
    expect(p.hasError).toBe(true);
    expect(p.hasWarning).toBe(true);
    expect(p.hasRestart).toBe(true);
    expect(p.errorCount).toBeGreaterThan(0);
  });

  it('empty table — all 24 buckets empty', () => {
    const db = setupDb();
    const result = getEventDensity(db);
    expect(result).toHaveLength(24);
    expect(result.every((b) => b.count === 0)).toBe(true);
  });
});

describe('getBucketedGatewayEvents — branch coverage', () => {
  it('returns gateway lifecycle events bucketed', () => {
    const db = setupDb();
    insertRow(db, 'gateway_restart', '2026-01-01T10:00:00Z');
    insertRow(db, 'gateway_start', '2026-01-01T10:05:00Z');
    insertRow(db, 'gateway_stop', '2026-01-01T10:10:00Z');

    const result = getBucketedGatewayEvents(db, '2026-01-01T09:00:00Z', '2026-01-01T11:00:00Z', 60);
    expect(result.length).toBe(3);
    const types = result.map((r) => r.type).sort();
    expect(types).toEqual(['gateway_restart', 'gateway_start', 'gateway_stop']);
  });

  it('returns empty array when no gateway events', () => {
    const db = setupDb();
    insertRow(db, 'error', '2026-01-01T10:00:00Z');
    const result = getBucketedGatewayEvents(db, '2026-01-01T09:00:00Z', '2026-01-01T11:00:00Z', 60);
    expect(result).toEqual([]);
  });
});
