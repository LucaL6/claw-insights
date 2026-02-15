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

export function getHourlyCount(db: Database, date: string, type: string): Array<{ hour: number; count: number }> {
  const stmt = db.prepare(`
    SELECT CAST(strftime('%H', timestamp) AS INTEGER) AS hour, COUNT(*) AS count
    FROM metric_events
    WHERE type = ? AND timestamp >= ? AND timestamp < date(?, '+1 day')
    GROUP BY hour
  `);
  return stmt.all(type, date + 'T00:00:00', date) as Array<{ hour: number; count: number }>;
}

export function getHourlySum(db: Database, date: string, type: string): Array<{ hour: number; total: number }> {
  const stmt = db.prepare(`
    SELECT CAST(strftime('%H', timestamp) AS INTEGER) AS hour, SUM(value) AS total
    FROM metric_events
    WHERE type = ? AND timestamp >= ? AND timestamp < date(?, '+1 day')
    GROUP BY hour
  `);
  return stmt.all(type, date + 'T00:00:00', date) as Array<{ hour: number; total: number }>;
}

export function getHourlyDistinctSessions(db: Database, date: string): Array<{ hour: number; sessions: number }> {
  const stmt = db.prepare(`
    SELECT CAST(strftime('%H', timestamp) AS INTEGER) AS hour,
           COUNT(DISTINCT json_extract(metadata, '$.key')) AS sessions
    FROM metric_events
    WHERE type = 'session_start' AND timestamp >= ? AND timestamp < date(?, '+1 day')
    GROUP BY hour
  `);
  return stmt.all(date + 'T00:00:00', date) as Array<{ hour: number; sessions: number }>;
}

export function getGatewayEvents(db: Database, date: string): Array<{ hour: number; type: string }> {
  const stmt = db.prepare(`
    SELECT CAST(strftime('%H', timestamp) AS INTEGER) AS hour, type
    FROM metric_events
    WHERE type IN ('gateway_start', 'gateway_stop', 'gateway_restart')
      AND timestamp >= ? AND timestamp < date(?, '+1 day')
  `);
  return stmt.all(date + 'T00:00:00', date) as Array<{ hour: number; type: string }>;
}

export function getRecentEvents(db: Database, type: string, limit: number = 50): Array<{ timestamp: string; metadata: string | null }> {
  const stmt = db.prepare('SELECT timestamp, metadata FROM metric_events WHERE type = ? ORDER BY timestamp DESC LIMIT ?');
  return stmt.all(type, limit) as Array<{ timestamp: string; metadata: string | null }>;
}

export function getHourlySampledSessions(db: Database, date: string): Array<{ hour: number; sessions: number }> {
  const stmt = db.prepare(`
    SELECT CAST(strftime('%H', timestamp) AS INTEGER) AS hour, MAX(active_sessions) AS sessions
    FROM metric_samples
    WHERE timestamp >= ? AND timestamp < date(?, '+1 day')
    GROUP BY hour
  `);
  return stmt.all(date + 'T00:00:00', date) as Array<{ hour: number; sessions: number }>;
}

export function getHourlySampledTokens(db: Database, date: string): Array<{ hour: number; tokensK: number }> {
  const stmt = db.prepare(`
    SELECT CAST(strftime('%H', timestamp) AS INTEGER) AS hour, MAX(total_tokens_k) AS tokensK
    FROM metric_samples
    WHERE timestamp >= ? AND timestamp < date(?, '+1 day')
    GROUP BY hour
  `);
  return stmt.all(date + 'T00:00:00', date) as Array<{ hour: number; tokensK: number }>;
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
