import { closeSync, existsSync, openSync, readFileSync, readSync } from 'node:fs';

import type { Database } from '../../../../db/database.js';
import {
  queryLifetimeAggregates,
  queryMinFirstTimestamp,
  queryMissingFirstTimestampPaths,
  queryTotalSessionFiles,
  updateFirstTimestamps,
} from '../../../../db/scan-state-queries.js';
import { createChildLogger } from '../../../../logger.js';

const log = createChildLogger('lifetime-stats');

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

export function emptyStats(): AggregatedStats {
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

export function formatStats(stats: AggregatedStats, initialScanDone: boolean): LifetimeStatsResult {
  const now = Date.now();
  const createdMs = stats.createdAtMs || now;
  return {
    isReady: initialScanDone,
    createdAt: new Date(createdMs).toISOString(),
    daysSinceCreation: Math.floor((now - createdMs) / MS_PER_DAY),
    totalSessions: stats.totalSessions,
    totalInputTokens: stats.totalInputTokens,
    totalOutputTokens: stats.totalOutputTokens,
    totalCacheReadTokens: stats.totalCacheReadTokens,
    totalCacheWriteTokens: stats.totalCacheWriteTokens,
    totalTokens:
      stats.totalInputTokens +
      stats.totalOutputTokens +
      stats.totalCacheReadTokens +
      stats.totalCacheWriteTokens,
    totalUserMessages: stats.totalUserMessages,
    totalAssistantMessages: stats.totalAssistantMessages,
  };
}

export function resolveCreatedAt(db: Database, deviceJsonPath: string): number {
  let deviceMs = Infinity;
  try {
    if (existsSync(deviceJsonPath)) {
      const device = JSON.parse(readFileSync(deviceJsonPath, 'utf-8')) as { createdAtMs?: unknown };
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

export function backfillFirstTimestamps(db: Database): void {
  const paths = queryMissingFirstTimestampPaths(db);
  if (paths.length === 0) {
    return;
  }

  log.info({ count: paths.length }, 'backfilling first_timestamp_ms');
  const updates: Array<{ path: string; ts: number }> = [];
  for (const path of paths) {
    const ts = readFirstTimestamp(path);
    if (ts !== null) {
      updates.push({ path, ts });
    }
  }

  if (updates.length > 0) {
    updateFirstTimestamps(db, updates);
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

export function computeStats(db: Database, deviceJsonPath: string): AggregatedStats {
  const agg = queryLifetimeAggregates(db);
  return {
    createdAtMs: resolveCreatedAt(db, deviceJsonPath),
    totalSessions: queryTotalSessionFiles(db),
    totalInputTokens: agg.totalInputTokens,
    totalOutputTokens: agg.totalOutputTokens,
    totalCacheReadTokens: agg.totalCacheReadTokens,
    totalCacheWriteTokens: agg.totalCacheWriteTokens,
    totalUserMessages: agg.totalUserMessages,
    totalAssistantMessages: agg.totalAssistantMessages,
  };
}
