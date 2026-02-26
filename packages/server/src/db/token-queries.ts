import type { DatabaseSync as Database } from 'node:sqlite';

import type { TokenUsageEvent } from '../events/token-event-bus.js';
import { bucketExpr, cached } from './query-utils.js';

// ── Write ──

export function insertTokenUsageEvent(db: Database, event: TokenUsageEvent): void {
  const stmt = cached(
    db,
    'INSERT OR IGNORE INTO token_usage_events (timestamp, session_key, model, input_tokens, output_tokens, cache_read, cache_write) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );
  stmt.run(
    event.timestamp,
    event.sessionKey,
    event.model,
    event.inputTokens,
    event.outputTokens,
    event.cacheReadTokens,
    event.cacheWriteTokens,
  );
}

export function insertTokenUsageEventBatch(db: Database, events: TokenUsageEvent[]): void {
  if (events.length === 0) {
    return;
  }
  db.exec('BEGIN');
  try {
    const stmt = cached(
      db,
      'INSERT OR IGNORE INTO token_usage_events (timestamp, session_key, model, input_tokens, output_tokens, cache_read, cache_write) VALUES (?, ?, ?, ?, ?, ?, ?)',
    );
    for (const e of events) {
      stmt.run(
        e.timestamp,
        e.sessionKey,
        e.model,
        e.inputTokens,
        e.outputTokens,
        e.cacheReadTokens,
        e.cacheWriteTokens,
      );
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}

// ── Bucketed Reads ──

const TOKEN_SUM = 'SUM(input_tokens + output_tokens + cache_read + cache_write) / 1000.0';

export function getBucketedTokenUsage(
  db: Database,
  startTs: string,
  endTs: string,
  bucketMinutes: number,
): Array<{ bucket: number; tokensK: number }> {
  const expr = bucketExpr(bucketMinutes);
  const stmt = cached(
    db,
    `SELECT ${expr} AS bucket, ${TOKEN_SUM} AS tokensK FROM token_usage_events WHERE timestamp >= ? AND timestamp < ? GROUP BY bucket HAVING tokensK > 0`,
  );
  return stmt.all(startTs, endTs) as Array<{ bucket: number; tokensK: number }>;
}

export function getBucketedModelTokenUsage(
  db: Database,
  startTs: string,
  endTs: string,
  bucketMinutes: number,
): Array<{ bucket: number; model: string; tokensK: number }> {
  const expr = bucketExpr(bucketMinutes);
  const stmt = cached(
    db,
    `SELECT ${expr} AS bucket, model, ${TOKEN_SUM} AS tokensK FROM token_usage_events WHERE timestamp >= ? AND timestamp < ? GROUP BY bucket, model HAVING tokensK > 0`,
  );
  return stmt.all(startTs, endTs) as Array<{ bucket: number; model: string; tokensK: number }>;
}

export function getRangeTokenUsageK(db: Database, startTs: string, endTs: string): number {
  const stmt = cached(
    db,
    `SELECT COALESCE(${TOKEN_SUM}, 0) AS total FROM token_usage_events WHERE timestamp >= ? AND timestamp < ?`,
  );
  const row = stmt.get(startTs, endTs) as { total: number } | undefined;
  return row?.total ?? 0;
}
