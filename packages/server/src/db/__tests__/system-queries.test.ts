import { rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

import { initDatabase } from '../init.js';
import { getBucketedSessions, insertSystemSample } from '../system-queries';

function setup() {
  const dbPath = join(tmpdir(), `sq-${Date.now()}-${Math.random()}.db`);
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

describe('system-queries', () => {
  it('inserts a system sample', () => {
    const { db, cleanup } = setup();
    insertSystemSample(db, { activeSessions: 3, cpu: 15.5, memoryMb: 512 });
    const row = db.prepare('SELECT * FROM system_samples').get() as Record<string, unknown>;
    expect(row.active_sessions).toBe(3);
    expect(row.cpu).toBe(15.5);
    expect(row.memory_mb).toBe(512);
    cleanup();
  });

  it('returns bucketed session counts', () => {
    const { db, cleanup } = setup();
    db.prepare('INSERT INTO system_samples (timestamp, active_sessions, cpu, memory_mb) VALUES (?, ?, ?, ?)').run(
      '2026-02-27T10:01:00Z',
      3,
      10,
      256,
    );
    db.prepare('INSERT INTO system_samples (timestamp, active_sessions, cpu, memory_mb) VALUES (?, ?, ?, ?)').run(
      '2026-02-27T10:03:00Z',
      5,
      20,
      512,
    );

    const result = getBucketedSessions(db, '2026-02-27T10:00:00Z', '2026-02-27T10:05:00Z', 5);
    expect(result.length).toBe(1);
    expect(result[0].sessions).toBe(5); // MAX
    cleanup();
  });

  it('returns bucketed sessions from hourly table when useHourly=true', () => {
    const { db, cleanup } = setup();
    db.prepare(
      'INSERT INTO hourly_system_samples (hour, active_sessions_max, active_sessions_avg, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ).run('2026-02-27T10:00:00Z', 5, 3, 10, 20, 256, 512, 6);

    const result = getBucketedSessions(db, '2026-02-27T10:00:00Z', '2026-02-27T11:00:00Z', 60, true);
    expect(result.length).toBe(1);
    expect(result[0].sessions).toBe(5);
    cleanup();
  });
});
