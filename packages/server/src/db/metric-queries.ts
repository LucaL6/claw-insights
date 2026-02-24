import type { DatabaseSync as Database } from 'node:sqlite';

import { bucketExpr,cached } from './query-utils.js';

// ── Write ──

export function insertSample(
  db: Database,
  sample: {
    activeSessions: number;
    totalTokensK: number;
    tokenDeltaK: number;
    costToday: number;
    tokensTodayM: number;
    cpu: number;
    memoryMb: number;
  },
) {
  const stmt = cached(
    db,
    'INSERT INTO metric_samples (timestamp, active_sessions, total_tokens_k, token_delta_k, cost_today, tokens_today_m, cpu, memory_mb) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  );
  stmt.run(
    new Date().toISOString(),
    sample.activeSessions,
    sample.totalTokensK,
    sample.tokenDeltaK,
    sample.costToday,
    sample.tokensTodayM,
    sample.cpu,
    sample.memoryMb,
  );
}

export function insertModelSample(db: Database, sample: { model: string; totalTokensK: number; tokenDeltaK?: number }) {
  const stmt = cached(
    db,
    'INSERT INTO model_token_samples (timestamp, model, total_tokens_k, token_delta_k) VALUES (?, ?, ?, ?)',
  );
  stmt.run(new Date().toISOString(), sample.model, sample.totalTokensK, sample.tokenDeltaK ?? 0);
}

// ── Bucketed Reads ──

export function getBucketedSampledSessions(
  db: Database,
  startTs: string,
  endTs: string,
  bucketMinutes: number,
  useHourly = false,
): Array<{ bucket: number; sessions: number }> {
  if (useHourly) {
    return db
      .prepare(
        `SELECT ${bucketExpr(bucketMinutes).replace('timestamp', 'hour')} AS bucket, MAX(active_sessions_max) AS sessions FROM hourly_metric_samples WHERE hour >= ? AND hour < ? GROUP BY bucket`,
      )
      .all(startTs, endTs) as Array<{ bucket: number; sessions: number }>;
  }
  const expr = bucketExpr(bucketMinutes);
  const stmt = cached(
    db,
    `SELECT ${expr} AS bucket, MAX(active_sessions) AS sessions FROM metric_samples WHERE timestamp >= ? AND timestamp < ? GROUP BY bucket`,
  );
  return stmt.all(startTs, endTs) as Array<{ bucket: number; sessions: number }>;
}

export function getBucketedSampledTokens(
  db: Database,
  startTs: string,
  endTs: string,
  bucketMinutes: number,
  useHourly = false,
): Array<{ bucket: number; tokensK: number }> {
  if (useHourly) {
    return db
      .prepare(
        `SELECT ${bucketExpr(bucketMinutes).replace('timestamp', 'hour')} AS bucket, SUM(token_delta_k) AS tokensK FROM hourly_metric_samples WHERE hour >= ? AND hour < ? GROUP BY bucket HAVING tokensK > 0`,
      )
      .all(startTs, endTs) as Array<{ bucket: number; tokensK: number }>;
  }
  const expr = bucketExpr(bucketMinutes);
  const stmt = cached(
    db,
    `SELECT ${expr} AS bucket, SUM(token_delta_k) AS tokensK FROM metric_samples WHERE timestamp >= ? AND timestamp < ? GROUP BY bucket HAVING tokensK > 0`,
  );
  return stmt.all(startTs, endTs) as Array<{ bucket: number; tokensK: number }>;
}

export function getBucketedModelTokens(
  db: Database,
  startTs: string,
  endTs: string,
  bucketMinutes: number,
  useHourly = false,
): Array<{ bucket: number; model: string; tokensK: number }> {
  if (useHourly) {
    return db
      .prepare(
        `SELECT ${bucketExpr(bucketMinutes).replace('timestamp', 'hour')} AS bucket, model, SUM(token_delta_k) AS tokensK FROM hourly_model_tokens WHERE hour >= ? AND hour < ? GROUP BY bucket, model HAVING tokensK > 0`,
      )
      .all(startTs, endTs) as Array<{ bucket: number; model: string; tokensK: number }>;
  }
  const expr = bucketExpr(bucketMinutes);
  const stmt = cached(
    db,
    `SELECT ${expr} AS bucket, model, SUM(token_delta_k) AS tokensK FROM model_token_samples WHERE timestamp >= ? AND timestamp < ? GROUP BY bucket, model HAVING tokensK > 0`,
  );
  return stmt.all(startTs, endTs) as Array<{ bucket: number; model: string; tokensK: number }>;
}

/** Range-wide token delta: SUM of token_delta_k over entire range */
export function getRangeTokensK(db: Database, startTs: string, endTs: string, useHourly = false): number {
  if (useHourly) {
    const stmt = db.prepare(
      `SELECT COALESCE(SUM(token_delta_k), 0) AS delta FROM hourly_metric_samples WHERE hour >= ? AND hour < ?`,
    );
    const row = stmt.get(startTs, endTs) as { delta: number } | undefined;
    return row?.delta ?? 0;
  }
  const stmt = cached(
    db,
    `SELECT COALESCE(SUM(token_delta_k), 0) AS delta FROM metric_samples WHERE timestamp >= ? AND timestamp < ?`,
  );
  const row = stmt.get(startTs, endTs) as { delta: number } | undefined;
  return row?.delta ?? 0;
}
