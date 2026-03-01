import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import type { ScanStateRow } from '../../db/scan-state-queries.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('file-classifier');

export interface FileState {
  offset: number;
  inode: number;
  birthtimeMs: number;
  partialLine: string;
}

export interface FileToScan {
  path: string;
  offset: number;
  partial: string;
  prevFirstTimestampMs: number | null;
}

export interface ClassifyResult {
  unchanged: Map<string, FileState>;
  toScan: FileToScan[];
  deleted: string[];
  deferred: FileToScan[];
}

export function classifyFiles(
  transcriptsDir: string,
  cached: Map<string, ScanStateRow>,
  mtimeCutoff?: number,
): ClassifyResult {
  const unchanged = new Map<string, FileState>();
  const toScan: FileToScan[] = [];
  const deleted: string[] = [];
  const deferred: FileToScan[] = [];

  if (!existsSync(transcriptsDir)) {
    return { unchanged, toScan, deleted: [], deferred: [] };
  }

  const diskFiles = readdirSync(transcriptsDir)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => join(transcriptsDir, f));

  const diskSet = new Set(diskFiles);

  for (const [filePath] of cached) {
    if (!diskSet.has(filePath)) {
      deleted.push(filePath);
    }
  }

  for (const filePath of diskFiles) {
    let st;
    try {
      st = statSync(filePath);
    } catch (err) {
      log.warn({ file: filePath, err }, 'stat failed, skipping');
      continue;
    }
    const prev = cached.get(filePath);

    if (mtimeCutoff !== undefined && st.mtimeMs < mtimeCutoff) {
      deferred.push({
        path: filePath,
        offset: prev ? prev.byteOffset : 0,
        partial: prev ? prev.partial : '',
        prevFirstTimestampMs: prev ? prev.firstTimestampMs : null,
      });
      continue;
    }

    if (prev && prev.inode === st.ino && prev.mtimeMs === st.mtimeMs && st.size === prev.byteOffset) {
      unchanged.set(filePath, {
        offset: prev.byteOffset,
        inode: prev.inode,
        birthtimeMs: prev.birthMs,
        partialLine: prev.partial,
      });
    } else if (prev && prev.inode === st.ino && st.size > prev.byteOffset) {
      toScan.push({
        path: filePath,
        offset: prev.byteOffset,
        partial: prev.partial,
        prevFirstTimestampMs: prev.firstTimestampMs,
      });
    } else {
      toScan.push({ path: filePath, offset: 0, partial: '', prevFirstTimestampMs: null });
    }
  }

  return { unchanged, toScan, deleted, deferred };
}
