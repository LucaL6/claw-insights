import { createChildLogger } from '../logger.js';
import type { Database } from './database.js';
import { bucketExpr, cached, timedQuery } from './query-utils.js';

const log = createChildLogger('db:system-queries');

export function insertSystemSample(
  db: Database,
  sample: { activeSessions: number; cpu: number; memoryMb: number },
): void {
  const stmt = cached(
    db,
    'INSERT INTO system_samples (timestamp, active_sessions, cpu, memory_mb) VALUES (?, ?, ?, ?)',
  );
  stmt.run(new Date().toISOString(), sample.activeSessions, sample.cpu, sample.memoryMb);
}

export function getBucketedSessions(
  db: Database,
  startTs: string,
  endTs: string,
  bucketMinutes: number,
  useHourly = false,
): Array<{ bucket: number; sessions: number }> {
  return timedQuery(log, 'getBucketedSessions', () => {
    if (useHourly) {
      const hourExpr = bucketExpr(bucketMinutes).replace('timestamp', 'hour');
      return db
        .prepare(
          `SELECT ${hourExpr} AS bucket, MAX(active_sessions_max) AS sessions FROM hourly_system_samples WHERE hour >= ? AND hour < ? GROUP BY bucket`,
        )
        .all(startTs, endTs);
    }
    const expr = bucketExpr(bucketMinutes);
    const stmt = cached(
      db,
      `SELECT ${expr} AS bucket, MAX(active_sessions) AS sessions FROM system_samples WHERE timestamp >= ? AND timestamp < ? GROUP BY bucket`,
    );
    return stmt.all(startTs, endTs);
  });
}

// ── Companion Days ──

/** Read the persisted companion_since timestamp, or null if not yet stored. */
export function getCompanionSince(db: Database): string | null {
  const row = db.prepare('SELECT value FROM kv_meta WHERE key = ?').get('companion_since');
  return row?.value ?? null;
}

/** Persist companion_since — INSERT IGNORE so the first write wins forever. */
export function setCompanionSince(db: Database, isoTimestamp: string): void {
  db.prepare('INSERT OR IGNORE INTO kv_meta (key, value) VALUES (?, ?)').run('companion_since', isoTimestamp);
}
