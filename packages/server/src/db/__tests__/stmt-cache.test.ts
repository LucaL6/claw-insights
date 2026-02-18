import { describe, it, expect, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { insertEvent } from '../event-queries';

describe('prepared statement cache', () => {
  it('should reuse statements across calls', () => {
    const db = new DatabaseSync(':memory:');
    db.exec(`CREATE TABLE metric_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL, type TEXT NOT NULL,
      value REAL, metadata TEXT, module TEXT,
      category TEXT, source TEXT
    )`);
    const prepareSpy = vi.spyOn(db, 'prepare');

    insertEvent(db, 'test', 1);
    insertEvent(db, 'test', 2);
    insertEvent(db, 'test', 3);

    // prepare should be called only once for the insert SQL
    const insertCalls = prepareSpy.mock.calls.filter((c) => (c[0] as string).includes('INSERT INTO metric_events'));
    expect(insertCalls.length).toBe(1);
  });
});
