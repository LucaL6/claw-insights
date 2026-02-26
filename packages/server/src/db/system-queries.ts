import type { DatabaseSync as Database } from 'node:sqlite';

import { bucketExpr, cached } from './query-utils.js';

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
  if (useHourly) {
    const hourExpr = bucketExpr(bucketMinutes).replace('timestamp', 'hour');
    return db
      .prepare(
        `SELECT ${hourExpr} AS bucket, MAX(active_sessions_max) AS sessions FROM hourly_system_samples WHERE hour >= ? AND hour < ? GROUP BY bucket`,
      )
      .all(startTs, endTs) as Array<{ bucket: number; sessions: number }>;
  }
  const expr = bucketExpr(bucketMinutes);
  const stmt = cached(
    db,
    `SELECT ${expr} AS bucket, MAX(active_sessions) AS sessions FROM system_samples WHERE timestamp >= ? AND timestamp < ? GROUP BY bucket`,
  );
  return stmt.all(startTs, endTs) as Array<{ bucket: number; sessions: number }>;
}
