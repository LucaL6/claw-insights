import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { queryEvents } from '../queries.js';

function setupDb(): Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE metric_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      type TEXT NOT NULL,
      value REAL,
      metadata TEXT
    );
    CREATE INDEX idx_events_type_time ON metric_events(type, timestamp);
    CREATE INDEX idx_events_time ON metric_events(timestamp DESC);
  `);
  return db;
}

function insertMany(db: Database, type: string, count: number, baseTime: number) {
  const stmt = db.prepare('INSERT INTO metric_events (timestamp, type, metadata) VALUES (?, ?, ?)');
  for (let i = 0; i < count; i++) {
    const ts = new Date((baseTime + i) * 1000).toISOString();
    stmt.run(ts, type, JSON.stringify({ module: 'test', message: `${type} #${i}` }));
  }
}

describe('queryEvents', () => {
  it('should return events and matching counts for small datasets', () => {
    const db = setupDb();
    const now = Math.floor(Date.now() / 1000);
    insertMany(db, 'error', 3, now - 100);
    insertMany(db, 'warning', 2, now - 50);

    const result = queryEvents(db, { from: now - 200, to: now + 100, limit: 200 });
    expect(result.events.length).toBe(5);
    expect(result.counts.error).toBe(3);
    expect(result.counts.warning).toBe(2);
    expect(result.total).toBe(5);
  });

  it('counts should reflect displayed rows when LIMIT truncates', () => {
    const db = setupDb();
    const now = Math.floor(Date.now() / 1000);
    // Insert 10 warnings (older) then 15 errors (newer)
    insertMany(db, 'warning', 10, now - 200);
    insertMany(db, 'error', 15, now - 100);

    const result = queryEvents(db, { from: now - 300, to: now + 100, limit: 20 });
    // LIMIT 20: gets 15 errors + 5 warnings (by recency)
    expect(result.events.length).toBe(20);
    expect(result.counts.error).toBe(15);
    expect(result.counts.warning).toBe(5);
    // total should reflect ALL matching, for truncation indicator
    expect(result.total).toBe(25);
  });

  it('counts should match events when under LIMIT', () => {
    const db = setupDb();
    const now = Math.floor(Date.now() / 1000);
    insertMany(db, 'error', 5, now - 100);
    insertMany(db, 'warning', 3, now - 50);

    const result = queryEvents(db, { from: now - 200, to: now + 100, limit: 200 });
    const errorCount = result.events.filter(e => e.type === 'error').length;
    const warnCount = result.events.filter(e => e.type === 'warning').length;
    expect(result.counts.error).toBe(errorCount);
    expect(result.counts.warning).toBe(warnCount);
  });

  it('total should be >= sum of displayed counts for truncation detection', () => {
    const db = setupDb();
    const now = Math.floor(Date.now() / 1000);
    insertMany(db, 'error', 150, now - 300);
    insertMany(db, 'warning', 100, now - 500);

    const result = queryEvents(db, { from: now - 600, to: now + 100, limit: 200 });
    const displayedTotal = result.counts.error + result.counts.warning + result.counts.restart;
    expect(result.events.length).toBe(200);
    expect(displayedTotal).toBe(200);
    expect(result.total).toBe(250);
  });
});
