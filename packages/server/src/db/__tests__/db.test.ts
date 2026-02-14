import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { initDatabase } from '../init';
import { insertEvent, getHourlyCount, getHourlySum, getRecentEvents, getSpawnEvents } from '../queries';
import { rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import type { Database } from 'bun:sqlite';

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
    expect(indexes.length).toBe(2);
  });

  it('should insert and query events', () => {
    insertEvent(db, 'error', null, { module: 'tools', message: 'exec failed' });
    insertEvent(db, 'error', null, { module: 'agent', message: 'timeout' });
    insertEvent(db, 'warning', null, { module: 'tools', message: 'slow' });

    const today = new Date().toISOString().split('T')[0];
    const errors = getHourlyCount(db, today, 'error');
    expect(errors.length).toBe(1);
    expect(errors[0].count).toBe(2);
  });

  it('should sum values for token_usage', () => {
    // Insert with explicit timestamps in current hour
    const now = new Date().toISOString();
    db.prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)').run(now, 'token_usage', 5.2, null);
    db.prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)').run(now, 'token_usage', 3.1, null);

    const today = new Date().toISOString().split('T')[0];
    const tokens = getHourlySum(db, today, 'token_usage');
    expect(tokens.length).toBe(1);
    expect(tokens[0].total).toBeCloseTo(8.3, 1);
  });

  it('should query recent events', () => {
    insertEvent(db, 'error', null, { message: 'first' });
    insertEvent(db, 'error', null, { message: 'second' });
    insertEvent(db, 'error', null, { message: 'third' });

    const recent = getRecentEvents(db, 'error', 2);
    expect(recent.length).toBe(2);
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
});
