import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { initDatabase } from '../init';
import { insertEvent, getHourlyCount, getHourlySum, getRecentEvents, getSpawnEvents, getHourlySampledSessions, getHourlySampledTokens, insertSample } from '../queries';
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

  it('should query hourly max active sessions from samples', () => {
    const stmt = db.prepare('INSERT INTO metric_samples (timestamp, active_sessions, total_tokens_k, token_delta_k, cost_today, tokens_today_m, cpu, memory_mb) VALUES (?, ?, ?, ?, 0, 0, 0, 0)');
    stmt.run('2026-02-15T10:05:00Z', 3, 100, 2);
    stmt.run('2026-02-15T10:35:00Z', 5, 105, 3);
    stmt.run('2026-02-15T11:05:00Z', 2, 110, 1);

    const result = getHourlySampledSessions(db, '2026-02-15');
    expect(result.length).toBeGreaterThanOrEqual(2);
    const h10 = result.find(r => r.hour === 10);
    expect(h10!.sessions).toBe(5);
  });

  it('should query hourly max total tokens from samples', () => {
    const stmt = db.prepare('INSERT INTO metric_samples (timestamp, active_sessions, total_tokens_k, token_delta_k, cost_today, tokens_today_m, cpu, memory_mb) VALUES (?, 0, ?, 0, 0, 0, 0, 0)');
    stmt.run('2026-02-15T10:05:00Z', 100);
    stmt.run('2026-02-15T10:35:00Z', 150); // MAX within hour
    stmt.run('2026-02-15T11:05:00Z', 200);

    const result = getHourlySampledTokens(db, '2026-02-15');
    const h10 = result.find(r => r.hour === 10);
    expect(h10!.tokensK).toBe(150); // MAX, not SUM
    const h11 = result.find(r => r.hour === 11);
    expect(h11!.tokensK).toBe(200);
  });
});
