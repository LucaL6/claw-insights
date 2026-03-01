import type { Database } from './database.js';
import { cached } from './query-utils.js';

export interface ScanStateRow {
  filePath: string;
  byteOffset: number;
  inode: number;
  mtimeMs: number;
  birthMs: number;
  partial: string;
  firstTimestampMs: number | null;
}

export function loadScanState(db: Database): Map<string, ScanStateRow> {
  const rows = db
    .prepare('SELECT file_path, byte_offset, inode, mtime_ms, birth_ms, partial, first_timestamp_ms FROM scan_state')
    .all<{
      file_path: string;
      byte_offset: number;
      inode: number;
      mtime_ms: number;
      birth_ms: number;
      partial: string;
      first_timestamp_ms: number | null;
    }>();

  const map = new Map<string, ScanStateRow>();
  for (const r of rows) {
    map.set(r.file_path, {
      filePath: r.file_path,
      byteOffset: r.byte_offset,
      inode: r.inode,
      mtimeMs: r.mtime_ms,
      birthMs: r.birth_ms,
      partial: r.partial,
      firstTimestampMs: r.first_timestamp_ms,
    });
  }
  return map;
}

export function upsertScanState(db: Database, entries: ScanStateRow[]): void {
  if (entries.length === 0) {
    return;
  }

  db.transaction((tx) => {
    const stmt = cached(
      tx,
      `INSERT INTO scan_state (file_path, byte_offset, inode, mtime_ms, birth_ms, partial, first_timestamp_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(file_path) DO UPDATE SET
         byte_offset = excluded.byte_offset, inode = excluded.inode,
         mtime_ms = excluded.mtime_ms, birth_ms = excluded.birth_ms,
         partial = excluded.partial, first_timestamp_ms = excluded.first_timestamp_ms`,
    );
    for (const e of entries) {
      stmt.run(e.filePath, e.byteOffset, e.inode, e.mtimeMs, e.birthMs, e.partial, e.firstTimestampMs ?? null);
    }
  });
}

export function deleteScanState(db: Database, filePaths: string[]): void {
  if (filePaths.length === 0) {
    return;
  }
  const stmt = cached(db, 'DELETE FROM scan_state WHERE file_path = ?');
  for (const p of filePaths) {
    stmt.run(p);
  }
}

export function queryMinFirstTimestamp(db: Database): number | null {
  const row = db
    .prepare('SELECT MIN(first_timestamp_ms) AS min_ts FROM scan_state WHERE first_timestamp_ms IS NOT NULL')
    .get<{ min_ts: number | null }>();
  return row?.min_ts ?? null;
}

export interface LifetimeAggregates {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalUserMessages: number;
  totalAssistantMessages: number;
  totalSessions: number;
}

export function queryLifetimeAggregates(db: Database): LifetimeAggregates {
  const tokens = db
    .prepare(
      `SELECT COALESCE(SUM(input_tokens), 0) AS inp, COALESCE(SUM(output_tokens), 0) AS out_,
            COALESCE(SUM(cache_read), 0) AS cr, COALESCE(SUM(cache_write), 0) AS cw
     FROM token_usage_events`,
    )
    .get<{ inp: number; out_: number; cr: number; cw: number }>() ?? { inp: 0, out_: 0, cr: 0, cw: 0 };

  const msgs = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END), 0) AS usr,
            COALESCE(SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END), 0) AS ast,
            COUNT(DISTINCT session_key) AS sess
     FROM message_events`,
    )
    .get<{ usr: number; ast: number; sess: number }>() ?? { usr: 0, ast: 0, sess: 0 };

  return {
    totalInputTokens: tokens.inp,
    totalOutputTokens: tokens.out_,
    totalCacheReadTokens: tokens.cr,
    totalCacheWriteTokens: tokens.cw,
    totalUserMessages: msgs.usr,
    totalAssistantMessages: msgs.ast,
    totalSessions: msgs.sess,
  };
}

export function queryTotalSessionFiles(db: Database): number {
  const row = db.prepare('SELECT COUNT(*) AS cnt FROM scan_state').get<{ cnt: number }>();
  return row?.cnt ?? 0;
}
