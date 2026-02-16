import type { Database } from 'bun:sqlite';

export interface MetricEvent {
  type: string;
  value?: number | null;
  metadata?: Record<string, unknown>;
}

export function insertEvent(db: Database, type: string, value?: number | null, metadata?: Record<string, unknown>) {
  const stmt = db.prepare('INSERT INTO metric_events (timestamp, type, value, metadata) VALUES (?, ?, ?, ?)');
  stmt.run(new Date().toISOString(), type, value ?? null, metadata ? JSON.stringify(metadata) : null);
}

export function getRecentEvents(db: Database, type: string, limit: number = 50): Array<{ timestamp: string; metadata: string | null }> {
  const stmt = db.prepare('SELECT timestamp, metadata FROM metric_events WHERE type = ? ORDER BY timestamp DESC LIMIT ?');
  return stmt.all(type, limit) as Array<{ timestamp: string; metadata: string | null }>;
}

// ── Range-based bucketed queries ──

export type MetricsRangeKey = 'ONE_HOUR' | 'SIX_HOUR' | 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR';

interface RangeConfig {
  rangeMinutes: number;
  bucketMinutes: number;
  bucketCount: number;
}

export const RANGE_CONFIG: Record<MetricsRangeKey, RangeConfig> = {
  ONE_HOUR:         { rangeMinutes: 60,   bucketMinutes: 5,  bucketCount: 12 },
  SIX_HOUR:         { rangeMinutes: 360,  bucketMinutes: 15, bucketCount: 24 },
  TWELVE_HOUR:      { rangeMinutes: 720,  bucketMinutes: 30, bucketCount: 24 },
  TWENTY_FOUR_HOUR: { rangeMinutes: 1440, bucketMinutes: 60, bucketCount: 24 },
};

/** Compute the start ISO timestamp for a given range (from now looking back) */
export function rangeStart(range: MetricsRangeKey): string {
  const now = new Date();
  const start = new Date(now.getTime() - RANGE_CONFIG[range].rangeMinutes * 60_000);
  return start.toISOString();
}

function bucketExpr(bucketMinutes: number): string {
  const bucketSeconds = bucketMinutes * 60;
  return `CAST(strftime('%s', timestamp) AS INTEGER) / ${bucketSeconds}`;
}

export function bucketLabel(bucket: number, bucketMinutes: number): string {
  const epochMs = bucket * bucketMinutes * 60 * 1000;
  const d = new Date(epochMs);
  const h = d.getHours();
  const m = d.getMinutes();
  if (bucketMinutes >= 60) return `${h}:00`;
  return `${h}:${m.toString().padStart(2, '0')}`;
}

export function getBucketedEventCount(
  db: Database, startTs: string, endTs: string, type: string, bucketMinutes: number,
): Array<{ bucket: number; count: number }> {
  const expr = bucketExpr(bucketMinutes);
  const stmt = db.prepare(`
    SELECT ${expr} AS bucket, COUNT(*) AS count
    FROM metric_events
    WHERE type = ? AND timestamp >= ? AND timestamp < ?
    GROUP BY bucket
  `);
  return stmt.all(type, startTs, endTs) as Array<{ bucket: number; count: number }>;
}

export function getBucketedSampledSessions(
  db: Database, startTs: string, endTs: string, bucketMinutes: number,
): Array<{ bucket: number; sessions: number }> {
  const expr = bucketExpr(bucketMinutes);
  const stmt = db.prepare(`
    SELECT ${expr} AS bucket, MAX(active_sessions) AS sessions
    FROM metric_samples
    WHERE timestamp >= ? AND timestamp < ?
    GROUP BY bucket
  `);
  return stmt.all(startTs, endTs) as Array<{ bucket: number; sessions: number }>;
}

export function getBucketedSampledTokens(
  db: Database, startTs: string, endTs: string, bucketMinutes: number,
): Array<{ bucket: number; tokensK: number }> {
  const expr = bucketExpr(bucketMinutes);
  const stmt = db.prepare(`
    SELECT ${expr} AS bucket,
           MAX(total_tokens_k) - MIN(total_tokens_k) AS tokensK
    FROM metric_samples
    WHERE timestamp >= ? AND timestamp < ?
    GROUP BY bucket
    HAVING tokensK > 0
  `);
  return stmt.all(startTs, endTs) as Array<{ bucket: number; tokensK: number }>;
}

export function getBucketedModelTokens(
  db: Database, startTs: string, endTs: string, bucketMinutes: number,
): Array<{ bucket: number; model: string; tokensK: number }> {
  const expr = bucketExpr(bucketMinutes);
  const stmt = db.prepare(`
    SELECT ${expr} AS bucket,
           model,
           MAX(total_tokens_k) - MIN(total_tokens_k) AS tokensK
    FROM model_token_samples
    WHERE timestamp >= ? AND timestamp < ?
    GROUP BY bucket, model
    HAVING tokensK > 0
  `);
  return stmt.all(startTs, endTs) as Array<{ bucket: number; model: string; tokensK: number }>;
}

/** Range-wide token delta: MAX - MIN of total_tokens_k over entire range */
export function getRangeTokensK(
  db: Database, startTs: string, endTs: string,
): number {
  const stmt = db.prepare(`
    SELECT COALESCE(MAX(total_tokens_k) - MIN(total_tokens_k), 0) AS delta
    FROM metric_samples
    WHERE timestamp >= ? AND timestamp < ?
  `);
  const row = stmt.get(startTs, endTs) as { delta: number } | undefined;
  return row?.delta ?? 0;
}

export function getBucketedGatewayEvents(
  db: Database, startTs: string, endTs: string, bucketMinutes: number,
): Array<{ bucket: number; type: string }> {
  const expr = bucketExpr(bucketMinutes);
  const stmt = db.prepare(`
    SELECT ${expr} AS bucket, type
    FROM metric_events
    WHERE type IN ('gateway_start', 'gateway_stop', 'gateway_restart')
      AND timestamp >= ? AND timestamp < ?
  `);
  return stmt.all(startTs, endTs) as Array<{ bucket: number; type: string }>;
}

export function insertSample(db: Database, sample: {
  activeSessions: number;
  totalTokensK: number;
  tokenDeltaK: number;
  costToday: number;
  tokensTodayM: number;
  cpu: number;
  memoryMb: number;
}) {
  const stmt = db.prepare(
    'INSERT INTO metric_samples (timestamp, active_sessions, total_tokens_k, token_delta_k, cost_today, tokens_today_m, cpu, memory_mb) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
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

export function insertModelSample(db: Database, sample: {
  model: string;
  totalTokensK: number;
}) {
  const stmt = db.prepare(
    'INSERT INTO model_token_samples (timestamp, model, total_tokens_k) VALUES (?, ?, ?)'
  );
  stmt.run(new Date().toISOString(), sample.model, sample.totalTokensK);
}

export function getSpawnEvents(db: Database, date: string): Array<{ parentKey: string; childKey: string; timestamp: string }> {
  const stmt = db.prepare(`
    SELECT json_extract(metadata, '$.parentKey') AS parentKey,
           json_extract(metadata, '$.childKey') AS childKey,
           timestamp
    FROM metric_events
    WHERE type = 'spawn_agent' AND timestamp >= ? AND timestamp < date(?, '+1 day')
    ORDER BY timestamp
  `);
  return stmt.all(date + 'T00:00:00', date) as Array<{ parentKey: string; childKey: string; timestamp: string }>;
}
