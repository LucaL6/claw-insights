import type { TokenUsageEvent } from '../events/token-event-bus.js';
import { createChildLogger } from '../logger.js';
import type { Database } from './database.js';
import { bucketExpr, cached, timedQuery } from './query-utils.js';

const log = createChildLogger('db:token-queries');

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

  db.transaction((tx) => {
    const stmt = cached(
      tx,
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
  });
}

// ── Bucketed Reads ──

const TOKEN_SUM = 'SUM(input_tokens + output_tokens + cache_read + cache_write) / 1000.0';

export function getBucketedTokenUsage(
  db: Database,
  startTs: string,
  endTs: string,
  bucketMinutes: number,
): Array<{ bucket: number; tokensK: number }> {
  return timedQuery(log, 'getBucketedTokenUsage', () => {
    const expr = bucketExpr(bucketMinutes);
    const stmt = cached(
      db,
      `SELECT ${expr} AS bucket, ${TOKEN_SUM} AS tokensK FROM token_usage_events WHERE timestamp >= ? AND timestamp < ? GROUP BY bucket HAVING tokensK > 0`,
    );
    return stmt.all<{ bucket: number; tokensK: number }>(startTs, endTs);
  });
}

export function getBucketedModelTokenUsage(
  db: Database,
  startTs: string,
  endTs: string,
  bucketMinutes: number,
): Array<{ bucket: number; model: string; tokensK: number }> {
  return timedQuery(log, 'getBucketedModelTokenUsage', () => {
    const expr = bucketExpr(bucketMinutes);
    const stmt = cached(
      db,
      `SELECT ${expr} AS bucket, model, ${TOKEN_SUM} AS tokensK FROM token_usage_events WHERE timestamp >= ? AND timestamp < ? GROUP BY bucket, model HAVING tokensK > 0`,
    );
    return stmt.all<{ bucket: number; model: string; tokensK: number }>(startTs, endTs);
  });
}

export function getRangeTokenUsageK(db: Database, startTs: string, endTs: string): number {
  return timedQuery(log, 'getRangeTokenUsageK', () => {
    const stmt = cached(
      db,
      `SELECT COALESCE(${TOKEN_SUM}, 0) AS total FROM token_usage_events WHERE timestamp >= ? AND timestamp < ?`,
    );
    const row = stmt.get<{ total: number }>(startTs, endTs);
    return row?.total ?? 0;
  });
}

export function getRangeModelTokenUsage(
  db: Database,
  startTs: string,
  endTs: string,
): Array<{ model: string; tokensK: number }> {
  return timedQuery(log, 'getRangeModelTokenUsage', () => {
    const stmt = cached(
      db,
      `SELECT model, ${TOKEN_SUM} AS tokensK FROM token_usage_events WHERE timestamp >= ? AND timestamp < ? GROUP BY model HAVING tokensK > 0 ORDER BY tokensK DESC`,
    );
    return stmt.all<{ model: string; tokensK: number }>(startTs, endTs);
  });
}
