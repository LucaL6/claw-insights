import type { DatabaseSync as Database } from 'node:sqlite';

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

// ── Range Config ──

export type MetricsRangeKey = 'ONE_HOUR' | 'SIX_HOUR' | 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR';

interface RangeConfig {
  rangeMinutes: number;
  bucketMinutes: number;
  bucketCount: number;
}

export const RANGE_CONFIG: Record<MetricsRangeKey, RangeConfig> = {
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
  if (bucketMinutes >= 60) return `${h}:00`;
  return `${h}:${m.toString().padStart(2, '0')}`;
}
