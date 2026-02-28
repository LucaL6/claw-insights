import { describe, expect, it } from 'vitest';

import { initDatabase } from '../init.js';
import { getCompanionSince, setCompanionSince } from '../system-queries.js';

describe('companion-days queries', () => {
  function freshDb() {
    return initDatabase(`/tmp/test-companion-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  }

  it('returns null when no companion_since is stored', () => {
    const db = freshDb();
    expect(getCompanionSince(db)).toBeNull();
    db.close();
  });

  it('stores and retrieves companion_since', () => {
    const db = freshDb();
    setCompanionSince(db, '2026-01-30T04:13:07.000Z');
    expect(getCompanionSince(db)).toBe('2026-01-30T04:13:07.000Z');
    db.close();
  });

  it('does not overwrite existing companion_since (write-once)', () => {
    const db = freshDb();
    setCompanionSince(db, '2026-01-30T04:13:07.000Z');
    setCompanionSince(db, '2026-02-15T00:00:00.000Z');
    expect(getCompanionSince(db)).toBe('2026-01-30T04:13:07.000Z');
    db.close();
  });
});
