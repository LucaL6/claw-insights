import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { initDatabase } from '../init.js';
import { getRangeTokenUsageK } from '../token-queries.js';

function setup() {
  const dbPath = join(tmpdir(), `tq-edge-${Date.now()}-${Math.random()}.db`);
  const db = initDatabase({ dbPath });
  return {
    db,
    cleanup: () => {
      db.close();
      rmSync(dbPath, { force: true });
      rmSync(dbPath + '-wal', { force: true });
      rmSync(dbPath + '-shm', { force: true });
    },
  };
}

describe('getRangeTokenUsageK branches', () => {
  it('returns 0 for empty range (row?.total ?? 0)', () => {
    const { db, cleanup } = setup();
    const result = getRangeTokenUsageK(db, '2099-01-01T00:00:00Z', '2099-01-01T01:00:00Z');
    expect(result).toBe(0);
    cleanup();
  });
});
