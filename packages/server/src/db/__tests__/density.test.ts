import { describe, it, expect } from 'bun:test';
import { Database } from 'bun:sqlite';
import { getEventDensity } from '../queries.js';

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
  `);
  return db;
}

describe('getEventDensity', () => {
  it('should return epochStart for each bucket', () => {
    const db = setupDb();
    db.prepare('INSERT INTO metric_events (timestamp, type, metadata) VALUES (?, ?, ?)')
      .run(new Date().toISOString(), 'error', '{"module":"test","message":"test error"}');

    const result = getEventDensity(db);

    expect(result.length).toBe(24);
    for (const bucket of result) {
      expect(typeof bucket.epochStart).toBe('number');
      expect(bucket.epochStart).toBeGreaterThan(0);
    }
    for (let i = 1; i < result.length; i++) {
      expect(result[i].epochStart - result[i - 1].epochStart).toBe(3600);
    }
    const nowBucket = Math.floor(Date.now() / 1000 / 3600);
    expect(result[23].epochStart).toBe(nowBucket * 3600);
  });

  it('epochStart should produce correct local hour', () => {
    const db = setupDb();
    const result = getEventDensity(db);
    for (const bucket of result) {
      const derivedHour = new Date(bucket.epochStart * 1000).getHours();
      expect(bucket.hour).toBe(derivedHour);
    }
  });

  it('should return hasWarning=true for buckets with warning events', () => {
    const db = setupDb();
    const now = new Date();
    const ts = now.toISOString();

    db.prepare('INSERT INTO metric_events (timestamp, type, metadata) VALUES (?, ?, ?)')
      .run(ts, 'warning', '{"module":"test","message":"test warning"}');

    const result = getEventDensity(db);
    const currentBucket = result[23]; // most recent hour
    expect(currentBucket.hasWarning).toBe(true);
    expect(currentBucket.hasError).toBe(false);
    expect(currentBucket.hasRestart).toBe(false);
    expect(currentBucket.count).toBe(1);
  });

  it('should return hasWarning=false for buckets without warning events', () => {
    const db = setupDb();
    const now = new Date();
    const ts = now.toISOString();

    db.prepare('INSERT INTO metric_events (timestamp, type, metadata) VALUES (?, ?, ?)')
      .run(ts, 'error', '{"module":"test","message":"test error"}');

    const result = getEventDensity(db);
    const currentBucket = result[23];
    expect(currentBucket.hasWarning).toBe(false);
    expect(currentBucket.hasError).toBe(true);
  });

  it('should return hasWarning=false for empty buckets', () => {
    const db = setupDb();
    const result = getEventDensity(db);
    for (const bucket of result) {
      expect(bucket.hasWarning).toBe(false);
    }
  });
});
