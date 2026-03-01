import { createChildLogger } from '../logger.js';
import { EVENT_MAP, mapEvent } from '../sources/events-mapper.js';
import type { Database, SqlParam } from './database.js';
import { bucketExpr, cached, timedQuery } from './query-utils.js';

const log = createChildLogger('db:event-queries');

// ── Write ──

export function insertEvent(db: Database, type: string, value?: number | null, metadata?: Record<string, unknown>) {
  const { category, source } = mapEvent(type);
  const stmt = cached(
    db,
    'INSERT INTO metric_events (timestamp, type, value, metadata, category, source) VALUES (?, ?, ?, ?, ?, ?)',
  );
  stmt.run(new Date().toISOString(), type, value ?? null, metadata ? JSON.stringify(metadata) : null, category, source);
}

// ── Read ──

export interface EventRow {
  timestamp: string;
  type: string;
  module: string;
  message: string;
}

export function queryEvents(
  db: Database,
  opts: {
    from?: number;
    to?: number;
    types?: string[];
    limit?: number;
  },
): { events: EventRow[]; total: number; counts: { error: number; warning: number; restart: number } } {
  return timedQuery(log, 'queryEvents', () => {
    const { from, to, types = ['error', 'warning', 'gateway_restart'], limit = 200 } = opts;

    const conditions: string[] = [];
    const params: SqlParam[] = [];

    if (types.length > 0) {
      const placeholders = types.map(() => '?').join(',');
      conditions.push(`(type IN (${placeholders}) OR category IN (${placeholders}))`);
      params.push(...types, ...types);
    }
    if (from !== undefined) {
      conditions.push(`CAST(strftime('%s', timestamp) AS INTEGER) >= ?`);
      params.push(from);
    }
    if (to !== undefined) {
      conditions.push(`CAST(strftime('%s', timestamp) AS INTEGER) < ?`);
      params.push(to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = db
      .prepare(`SELECT timestamp, type, category, metadata FROM metric_events ${where} ORDER BY timestamp DESC LIMIT ?`)
      .all<{ timestamp: string; type: string; category: string; metadata: string | null }>(...params, limit);

    const events: EventRow[] = rows.map((r) => {
      const meta = r.metadata ? JSON.parse(r.metadata) : {};
      let message: string = meta.message ?? '';
      if (message.startsWith('{') && message.endsWith('}')) {
        try {
          const inner = JSON.parse(message);
          message = Object.entries(inner)
            .map(([k, v]) => `${k}: ${String(v)}`)
            .join(', ');
        } catch {
          /* keep original */
        }
      }
      return { timestamp: r.timestamp, type: r.type, module: meta.module ?? 'system', message };
    });

    const totalRow = db.prepare(`SELECT COUNT(*) as cnt FROM metric_events ${where}`).get<{ cnt: number }>(...params);
    const total = totalRow?.cnt ?? 0;

    const counts = { error: 0, warning: 0, restart: 0 };
    for (const row of rows) {
      if (row.type === 'error' || row.category === 'severity.error') {
        counts.error++;
      }
      if (row.type === 'warning' || row.category === 'severity.warning') {
        counts.warning++;
      }
      if (row.type === 'gateway_restart' || row.category === 'lifecycle.restart') {
        counts.restart++;
      }
    }

    return { events, total, counts };
  });
}

export function getEventDensity(db: Database): Array<{
  hour: number;
  count: number;
  hasError: boolean;
  hasWarning: boolean;
  hasRestart: boolean;
  errorCount: number;
  warningCount: number;
  restartCount: number;
  epochStart: number;
}> {
  return timedQuery(log, 'getEventDensity', () => {
    const cutoff = Math.floor(Date.now() / 1000) - 86400;

    const rows = db
      .prepare(
        `
    SELECT
      CAST(strftime('%s', timestamp) AS INTEGER) / 3600 AS bucket_id,
      COUNT(*) as cnt,
      SUM(CASE WHEN type = 'error' OR category = 'severity.error' THEN 1 ELSE 0 END) as err_cnt,
      SUM(CASE WHEN type = 'warning' OR category = 'severity.warning' THEN 1 ELSE 0 END) as warn_cnt,
      SUM(CASE WHEN type = 'gateway_restart' OR category = 'lifecycle.restart' THEN 1 ELSE 0 END) as rst_cnt
    FROM metric_events
    WHERE CAST(strftime('%s', timestamp) AS INTEGER) >= ?
      AND (
        type IN ('error', 'warning', 'gateway_restart')
        OR category IN ('severity.error', 'severity.warning', 'lifecycle.restart')
      )
    GROUP BY bucket_id
    ORDER BY bucket_id
  `,
      )
      .all<{ bucket_id: number; cnt: number; err_cnt: number; warn_cnt: number; rst_cnt: number }>(cutoff);

    const nowBucket = Math.floor(Date.now() / 1000 / 3600);
    const result = [];
    for (let i = 0; i < 24; i++) {
      const bid = nowBucket - 23 + i;
      const row = rows.find((r) => r.bucket_id === bid);
      result.push({
        hour: new Date(bid * 3600 * 1000).getHours(),
        count: row?.cnt ?? 0,
        hasError: (row?.err_cnt ?? 0) > 0,
        hasWarning: (row?.warn_cnt ?? 0) > 0,
        hasRestart: (row?.rst_cnt ?? 0) > 0,
        errorCount: row?.err_cnt ?? 0,
        warningCount: row?.warn_cnt ?? 0,
        restartCount: row?.rst_cnt ?? 0,
        epochStart: bid * 3600,
      });
    }
    return result;
  });
}

export function getEventCounts(
  db: Database,
  opts: { from?: number; to?: number },
): { error: number; warning: number; restart: number } {
  return timedQuery(log, 'getEventCounts', () => {
    const conditions: string[] = [];
    const params: SqlParam[] = [];

    if (opts.from !== undefined) {
      conditions.push(`CAST(strftime('%s', timestamp) AS INTEGER) >= ?`);
      params.push(opts.from);
    }
    if (opts.to !== undefined) {
      conditions.push(`CAST(strftime('%s', timestamp) AS INTEGER) < ?`);
      params.push(opts.to);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const row = db
      .prepare(
        `SELECT
         SUM(CASE WHEN type = 'error' OR category = 'severity.error' THEN 1 ELSE 0 END) AS error,
         SUM(CASE WHEN type = 'warning' OR category = 'severity.warning' THEN 1 ELSE 0 END) AS warning,
         SUM(CASE WHEN type = 'gateway_restart' OR category = 'lifecycle.restart' THEN 1 ELSE 0 END) AS restart
       FROM metric_events ${where}`,
      )
      .get<{ error: number; warning: number; restart: number }>(...params);

    return { error: row?.error ?? 0, warning: row?.warning ?? 0, restart: row?.restart ?? 0 };
  });
}

export function getBucketedEventCount(
  db: Database,
  startTs: string,
  endTs: string,
  type: string,
  bucketMinutes: number,
): Array<{ bucket: number; count: number }> {
  return timedQuery(log, 'getBucketedEventCount', () => {
    const expr = bucketExpr(bucketMinutes);
    const mapped = EVENT_MAP[type];

    if (mapped) {
      const stmt = cached(
        db,
        `SELECT ${expr} AS bucket, COUNT(*) AS count FROM metric_events WHERE (type = ? OR category = ?) AND timestamp >= ? AND timestamp < ? GROUP BY bucket`,
      );
      return stmt.all<{ bucket: number; count: number }>(type, mapped.category, startTs, endTs);
    }

    const stmt = cached(
      db,
      `SELECT ${expr} AS bucket, COUNT(*) AS count FROM metric_events WHERE type = ? AND timestamp >= ? AND timestamp < ? GROUP BY bucket`,
    );
    return stmt.all<{ bucket: number; count: number }>(type, startTs, endTs);
  });
}

export function getBucketedGatewayEvents(
  db: Database,
  startTs: string,
  endTs: string,
  bucketMinutes: number,
): Array<{ bucket: number; type: string }> {
  return timedQuery(log, 'getBucketedGatewayEvents', () => {
    const expr = bucketExpr(bucketMinutes);
    const stmt = cached(
      db,
      `SELECT ${expr} AS bucket, CASE WHEN type = 'gateway_restart' OR category = 'lifecycle.restart' THEN 'gateway_restart' WHEN type = 'gateway_start' OR category = 'lifecycle.start' THEN 'gateway_start' WHEN type = 'gateway_stop' OR category = 'lifecycle.stop' THEN 'gateway_stop' END AS type FROM metric_events WHERE (type IN ('gateway_start', 'gateway_stop', 'gateway_restart') OR category IN ('lifecycle.start', 'lifecycle.stop', 'lifecycle.restart')) AND timestamp >= ? AND timestamp < ?`,
    );
    return stmt.all<{ bucket: number; type: string }>(startTs, endTs);
  });
}
