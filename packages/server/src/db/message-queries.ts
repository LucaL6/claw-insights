import type { DatabaseSync as Database } from 'node:sqlite';

import { contentHash } from '../sources/collectors/transcript-parser.js';
import { bucketExpr, cached } from './query-utils.js';

interface MessageEventRecord {
  timestamp: string;
  sessionKey: string;
  role: string;
  lineHash: string;
}

export function insertMessageEvent(db: Database, event: MessageEventRecord): void {
  const stmt = cached(
    db,
    'INSERT OR IGNORE INTO message_events (timestamp, session_key, role, content_hash) VALUES (?, ?, ?, ?)',
  );
  const hash = contentHash(event.timestamp, event.sessionKey, `${event.role}|${event.lineHash}`);
  stmt.run(event.timestamp, event.sessionKey, event.role, hash);
}

export function insertMessageEventBatch(db: Database, events: MessageEventRecord[]): void {
  if (events.length === 0) {
    return;
  }

  db.exec('BEGIN');
  try {
    const stmt = cached(
      db,
      'INSERT OR IGNORE INTO message_events (timestamp, session_key, role, content_hash) VALUES (?, ?, ?, ?)',
    );
    for (const e of events) {
      const hash = contentHash(e.timestamp, e.sessionKey, `${e.role}|${e.lineHash}`);
      stmt.run(e.timestamp, e.sessionKey, e.role, hash);
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

export function deleteAllMessageEvents(db: Database): void {
  db.exec('DELETE FROM message_events');
}

export function getRangeTurnCount(db: Database, startTs: string, endTs: string): number {
  const stmt = cached(
    db,
    "SELECT COUNT(*) AS turns FROM message_events WHERE timestamp >= ? AND timestamp < ? AND role IN ('user', 'assistant')",
  );
  const row = stmt.get(startTs, endTs) as { turns: number } | undefined;
  return row?.turns ?? 0;
}

export function getRangeTurnCountBySession(
  db: Database,
  startTs: string,
  endTs: string,
): Array<{ sessionKey: string; turns: number }> {
  const stmt = cached(
    db,
    "SELECT session_key AS sessionKey, COUNT(*) AS turns FROM message_events WHERE timestamp >= ? AND timestamp < ? AND role IN ('user', 'assistant') GROUP BY session_key ORDER BY turns DESC",
  );
  return stmt.all(startTs, endTs) as Array<{ sessionKey: string; turns: number }>;
}

export function getBucketedTurnCount(
  db: Database,
  startTs: string,
  endTs: string,
  bucketMinutes: number,
): Array<{ bucket: number; turns: number }> {
  const expr = bucketExpr(bucketMinutes);
  const stmt = cached(
    db,
    `SELECT ${expr} AS bucket, COUNT(*) AS turns FROM message_events WHERE timestamp >= ? AND timestamp < ? AND role IN ('user', 'assistant') GROUP BY bucket`,
  );
  return stmt.all(startTs, endTs) as Array<{ bucket: number; turns: number }>;
}

export function getBucketedTurnCountByRole(
  db: Database,
  startTs: string,
  endTs: string,
  bucketMinutes: number,
): Array<{ bucket: number; role: string; turns: number }> {
  const expr = bucketExpr(bucketMinutes);
  const stmt = cached(
    db,
    `SELECT ${expr} AS bucket, role, COUNT(*) AS turns FROM message_events WHERE timestamp >= ? AND timestamp < ? AND role IN ('user', 'assistant') GROUP BY bucket, role`,
  );
  return stmt.all(startTs, endTs) as Array<{ bucket: number; role: string; turns: number }>;
}
