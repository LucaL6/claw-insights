import { closeSync, existsSync, openSync, readFileSync, readSync } from 'node:fs';
import type { DatabaseSync as Database } from 'node:sqlite';

import { insertMessageEventBatch } from '../../db/message-queries.js';
import { cached } from '../../db/query-utils.js';
import {
  deleteScanState,
  loadScanState,
  queryLifetimeAggregates,
  queryMinFirstTimestamp,
  type ScanStateRow,
  upsertScanState,
} from '../../db/scan-state-queries.js';
import { insertTokenUsageEventBatch } from '../../db/token-queries.js';
import type { MessageEventBus } from '../../events/message-event-bus.js';
import type { TokenEventBus } from '../../events/token-event-bus.js';
import { createChildLogger } from '../../logger.js';
import { classifyFiles, type FileState } from './file-classifier.js';
import type { ParsedMessageEvent, ParsedTokenEvent } from './transcript-parser.js';
import { scanFiles, type ScanSink } from './transcript-scanner.js';

const log = createChildLogger('lifetime-scanner');

// ── Re-exports (keep API surface for external consumers) ──

export type { FileState } from './file-classifier.js';
export type { ClassifyResult, FileToScan } from './file-classifier.js';

// ── Types ──

export interface AggregatedStats {
  createdAtMs: number;
  totalSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalUserMessages: number;
  totalAssistantMessages: number;
}

export interface LifetimeStatsResult {
  isReady: boolean;
  createdAt: string;
  daysSinceCreation: number;
  totalSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalTokens: number;
  totalUserMessages: number;
  totalAssistantMessages: number;
}

// ── Scanner interface ──

export interface LifetimeScanner {
  init(): Promise<void>;
  getStats(): Promise<LifetimeStatsResult>;
  getFileStates(): Map<string, FileState>;
  isReady(): boolean;
  destroy(): void;
}

// ── Factory ──

export function createLifetimeScanner(opts: {
  db: Database;
  transcriptsDir: string;
  deviceJsonPath: string;
  tokenBus?: TokenEventBus;
  messageBus?: MessageEventBus;
}): LifetimeScanner {
  const { db, transcriptsDir, deviceJsonPath, tokenBus, messageBus } = opts;
  const fileStates = new Map<string, FileState>();
  let stats: AggregatedStats = emptyStats();
  let initialScanDone = false;
  let destroyed = false;
  let abortController: AbortController | null = null;

  // ── Sink with transactional flush ──
  const FLUSH_THRESHOLD = 5000;
  const STATE_FLUSH_THRESHOLD = 50;
  let tokenBuf: ParsedTokenEvent[] = [];
  let msgBuf: ParsedMessageEvent[] = [];
  let stateBuf: ScanStateRow[] = [];

  function flush(): void {
    if (tokenBuf.length === 0 && msgBuf.length === 0 && stateBuf.length === 0) {
      return;
    }
    db.exec('BEGIN');
    try {
      insertTokenUsageEventBatch(db, tokenBuf, false);
      insertMessageEventBatch(db, msgBuf, false);
      upsertScanState(db, stateBuf, false);
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
    tokenBuf = [];
    msgBuf = [];
    stateBuf = [];
  }

  const sink: ScanSink = {
    onToken(e) {
      tokenBuf.push(e);
      if (tokenBus) {
        tokenBus.emit(e);
      }
      if (tokenBuf.length >= FLUSH_THRESHOLD) {
        flush();
      }
    },
    onMessage(e) {
      msgBuf.push(e);
      if (messageBus) {
        messageBus.emit(e);
      }
      if (msgBuf.length >= FLUSH_THRESHOLD) {
        flush();
      }
    },
    onFileComplete(s) {
      fileStates.set(s.filePath, {
        offset: s.byteOffset,
        inode: s.inode,
        birthtimeMs: s.birthMs,
        partialLine: s.partial,
      });
      stateBuf.push(s);
      if (stateBuf.length >= STATE_FLUSH_THRESHOLD) {
        flush();
      }
    },
  };

  // ── init ──
  async function init(): Promise<void> {
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    if (destroyed) {
      return;
    }

    const startMs = Date.now();
    try {
      const cachedState = loadScanState(db);
      const { unchanged, toScan, deleted } = classifyFiles(transcriptsDir, cachedState);

      // Restore unchanged file states
      for (const [path, state] of unchanged) {
        fileStates.set(path, state);
      }

      // Scan changed files
      if (toScan.length > 0) {
        abortController = new AbortController();
        await scanFiles(toScan, sink, {
          onError: (file, err) => log.warn({ file, err }, 'scan error'),
          signal: abortController.signal,
        });
        abortController = null;
        flush(); // final flush for remaining buffered items
      }
      if (destroyed) {
        return;
      }

      // Clean up deleted
      if (deleted.length > 0) {
        deleteScanState(db, deleted);
      }

      // Backfill first_timestamp_ms for legacy rows
      backfillFirstTimestamps(db);

      // Compute stats from DB
      const agg = queryLifetimeAggregates(db);
      stats = {
        createdAtMs: resolveCreatedAt(db, deviceJsonPath),
        totalSessions: fileStates.size,
        totalInputTokens: agg.totalInputTokens,
        totalOutputTokens: agg.totalOutputTokens,
        totalCacheReadTokens: agg.totalCacheReadTokens,
        totalCacheWriteTokens: agg.totalCacheWriteTokens,
        totalUserMessages: agg.totalUserMessages,
        totalAssistantMessages: agg.totalAssistantMessages,
      };
      initialScanDone = true;
      log.info({ fileCount: fileStates.size, durationMs: Date.now() - startMs }, 'lifetime scan complete');
    } catch (err) {
      log.error({ err }, 'lifetime scan failed');
    }
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async function getStats(): Promise<LifetimeStatsResult> {
    return toResult();
  }

  function getFileStates(): Map<string, FileState> {
    return new Map(fileStates);
  }

  function isReady(): boolean {
    return initialScanDone;
  }

  function destroy(): void {
    destroyed = true;
    if (abortController) {
      abortController.abort();
      abortController = null;
    }
    fileStates.clear();
    stats = emptyStats();
    initialScanDone = false;
  }

  function toResult(): LifetimeStatsResult {
    const s = stats;
    const now = Date.now();
    const createdMs = s.createdAtMs || now;
    return {
      isReady: initialScanDone,
      createdAt: new Date(createdMs).toISOString(),
      daysSinceCreation: Math.floor((now - createdMs) / 86_400_000),
      totalSessions: s.totalSessions,
      totalInputTokens: s.totalInputTokens,
      totalOutputTokens: s.totalOutputTokens,
      totalCacheReadTokens: s.totalCacheReadTokens,
      totalCacheWriteTokens: s.totalCacheWriteTokens,
      totalTokens: s.totalInputTokens + s.totalOutputTokens + s.totalCacheReadTokens + s.totalCacheWriteTokens,
      totalUserMessages: s.totalUserMessages,
      totalAssistantMessages: s.totalAssistantMessages,
    };
  }

  return { init, getStats, getFileStates, isReady, destroy };
}

// ── Module-level helpers ──

function emptyStats(): AggregatedStats {
  return {
    createdAtMs: 0,
    totalSessions: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheReadTokens: 0,
    totalCacheWriteTokens: 0,
    totalUserMessages: 0,
    totalAssistantMessages: 0,
  };
}

function resolveCreatedAt(db: Database, deviceJsonPath: string): number {
  let deviceMs = Infinity;
  try {
    if (existsSync(deviceJsonPath)) {
      const device = JSON.parse(readFileSync(deviceJsonPath, 'utf-8'));
      deviceMs = typeof device.createdAtMs === 'number' ? device.createdAtMs : Infinity;
    }
  } catch {
    log.warn('failed to read device.json for createdAt');
  }

  const dbMin = queryMinFirstTimestamp(db);
  const earliestMs = dbMin !== null && dbMin > 0 ? dbMin : Infinity;

  if (earliestMs < Infinity) {
    return Math.min(deviceMs, earliestMs);
  }
  if (deviceMs < Infinity) {
    return deviceMs;
  }
  return Date.now();
}

function backfillFirstTimestamps(db: Database): void {
  const rows = db.prepare('SELECT file_path FROM scan_state WHERE first_timestamp_ms IS NULL').all() as Array<{
    file_path: string;
  }>;
  if (rows.length === 0) {
    return;
  }

  log.info({ count: rows.length }, 'backfilling first_timestamp_ms');
  const updates: Array<{ path: string; ts: number }> = [];
  for (const row of rows) {
    const ts = readFirstTimestamp(row.file_path);
    if (ts !== null) {
      updates.push({ path: row.file_path, ts });
    }
  }

  if (updates.length > 0) {
    const stmt = cached(db, 'UPDATE scan_state SET first_timestamp_ms = ? WHERE file_path = ?');
    db.exec('BEGIN');
    try {
      for (const u of updates) {
        stmt.run(u.ts, u.path);
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  }
}

function readFirstTimestamp(filePath: string, maxLines = 10): number | null {
  const BUF_SIZE = 8192;
  const buf = Buffer.alloc(BUF_SIZE);
  let fd: number;
  try {
    fd = openSync(filePath, 'r');
  } catch {
    return null;
  }
  try {
    const bytesRead = readSync(fd, buf, 0, BUF_SIZE, 0);
    if (bytesRead === 0) {
      return null;
    }
    const text = buf.subarray(0, bytesRead).toString('utf-8');
    const lines = text.split('\n');
    const limit = Math.min(lines.length, maxLines);
    for (let i = 0; i < limit; i++) {
      const line = lines[i].trim();
      if (!line) {
        continue;
      }
      try {
        const parsed = JSON.parse(line) as Record<string, unknown>;
        if (typeof parsed.timestamp === 'string') {
          const ms = new Date(parsed.timestamp).getTime();
          if (Number.isFinite(ms) && ms > 0) {
            return ms;
          }
        }
      } catch {
        /* skip */
      }
    }
    return null;
  } finally {
    closeSync(fd);
  }
}
