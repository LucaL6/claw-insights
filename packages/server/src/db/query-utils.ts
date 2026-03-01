import { performance } from 'node:perf_hooks';
import type { DatabaseSync as Database } from 'node:sqlite';

import type { Logger } from 'pino';

// timedQuery helper uses caller-provided logger (no module-level log needed)

// ── Statement Cache ──

const stmtCache = new WeakMap<Database, Map<string, ReturnType<Database['prepare']>>>();

export function cached(db: Database, sql: string): ReturnType<Database['prepare']> {
  let map = stmtCache.get(db);
  if (!map) {
    map = new Map();
    stmtCache.set(db, map);
  }
  let stmt = map.get(sql);
  if (!stmt) {
    stmt = db.prepare(sql);
    map.set(sql, stmt);
  }
  return stmt;
}

// ── Timed Query Helper ──

const SLOW_THRESHOLD_MS = 100;

/**
 * Execute a synchronous query function and log if it takes longer than SLOW_THRESHOLD_MS.
 * Uses `debug` level to avoid warn storms in production (debug is off by default).
 */
export function timedQuery<T>(queryLog: Logger, name: string, fn: () => T): T {
  const start = performance.now();
  const result = fn();
  const ms = performance.now() - start;
  if (ms > SLOW_THRESHOLD_MS) {
    queryLog.debug({ name, ms: Math.round(ms) }, 'slow query');
  }
  return result;
}

// ── Range Config ──

export type MetricsRangeKey = 'THIRTY_MIN' | 'ONE_HOUR' | 'SIX_HOUR' | 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR';

interface RangeConfig {
  rangeMinutes: number;
  bucketMinutes: number;
  bucketCount: number;
}

export const RANGE_CONFIG: Record<MetricsRangeKey, RangeConfig> = {
  THIRTY_MIN: { rangeMinutes: 30, bucketMinutes: 5, bucketCount: 6 },
  ONE_HOUR: { rangeMinutes: 60, bucketMinutes: 5, bucketCount: 12 },
  SIX_HOUR: { rangeMinutes: 360, bucketMinutes: 15, bucketCount: 24 },
  TWELVE_HOUR: { rangeMinutes: 720, bucketMinutes: 30, bucketCount: 24 },
  TWENTY_FOUR_HOUR: { rangeMinutes: 1440, bucketMinutes: 60, bucketCount: 24 },
};

/** Compute the start ISO timestamp for a given range (from now looking back) */
export function rangeStart(range: MetricsRangeKey): string {
  const now = new Date();
  const start = new Date(now.getTime() - RANGE_CONFIG[range].rangeMinutes * 60_000);
  return start.toISOString();
}

export function bucketExpr(bucketMinutes: number): string {
  const bucketSeconds = bucketMinutes * 60;
  return `CAST(strftime('%s', timestamp) AS INTEGER) / ${bucketSeconds}`;
}

export function bucketLabel(bucket: number, bucketMinutes: number): string {
  const epochMs = bucket * bucketMinutes * 60 * 1000;
  const d = new Date(epochMs);
  const h = d.getHours();
  const m = d.getMinutes();
  if (bucketMinutes >= 60) {
    return `${h}:00`;
  }
  return `${h}:${m.toString().padStart(2, '0')}`;
}
