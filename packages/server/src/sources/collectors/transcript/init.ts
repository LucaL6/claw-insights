import { basename } from 'node:path';

import { RANGE_CONFIG } from '../../../db/query-utils.js';
import { deleteScanState, loadScanState } from '../../../db/scan-state-queries.js';
import { createChildLogger } from '../../../logger.js';
import { type AggregatedStats,backfillFirstTimestamps, computeStats } from './persistence/lifetime-stats.js';
import { classifyFiles, type FileState as ClassifiedFileState, type FileToScan } from './processing/file-classifier.js';
import { createFileProcessor } from './processing/file-processor.js';
import type { ProcessFileOptions } from './processing/processor.js';
import type { FileResult, FileTask, TranscriptSink } from './types.js';

const log = createChildLogger('transcript-init');

/** Largest configured range × 2 — dynamic, tracks RANGE_CONFIG changes */
const MTIME_WINDOW_MS = Math.max(60, ...Object.values(RANGE_CONFIG).map((r) => r.rangeMinutes)) * 2 * 60_000;
const INIT_CHUNK_BYTES = 1_048_576;

export interface InitScanOptions {
  db: Parameters<typeof loadScanState>[0];
  transcriptsDir: string;
  deviceJsonPath: string;
  sink: TranscriptSink;
  process: (task: FileTask, opts?: ProcessFileOptions) => Promise<FileResult>;
  signal?: AbortSignal;
}

export interface InitScanResult {
  fileStates: Map<string, ClassifiedFileState>;
  stats: AggregatedStats;
  deferred: FileToScan[];
}

export async function initScan(opts: InitScanOptions): Promise<InitScanResult> {
  const { db, transcriptsDir, deviceJsonPath, sink, process, signal } = opts;
  const startMs = Date.now();
  const fileStates = new Map<string, ClassifiedFileState>();

  const cachedState = loadScanState(db);
  const useFullScan = cachedState.size === 0;
  const mtimeCutoff = useFullScan ? undefined : Date.now() - MTIME_WINDOW_MS;

  const { unchanged, toScan, deleted, deferred } = classifyFiles(transcriptsDir, cachedState, mtimeCutoff);

  for (const [path, state] of unchanged) {
    fileStates.set(path, state);
  }

  for (const d of deferred) {
    const prev = cachedState.get(d.path);
    if (!prev) {
      continue;
    }
    fileStates.set(d.path, {
      offset: prev.byteOffset,
      inode: prev.inode,
      birthtimeMs: prev.birthMs,
      partial: prev.partial,
    });
  }

  const processFile = createFileProcessor({ process, sink, chunkBytes: INIT_CHUNK_BYTES });
  let scanned = 0;

  try {
    for (const file of toScan) {
      if (signal?.aborted) {
        break;
      }

      const previous = cachedState.get(file.path);
      const task: FileTask = {
        path: file.path,
        offset: file.offset,
        partial: file.partial,
        prevFirstTimestampMs: file.prevFirstTimestampMs,
        sessionKey: basename(file.path, '.jsonl'),
        inode: previous?.inode,
        birthtimeMs: previous?.birthMs,
      };

      try {
        const newState = await processFile(task);
        fileStates.set(file.path, {
          offset: newState.offset,
          inode: newState.inode,
          birthtimeMs: newState.birthtimeMs,
          partial: newState.partial,
        });
        scanned += 1;
      } catch (err) {
        log.warn({ file: basename(file.path), err }, 'init scan file failed');
      }
    }

    if (deleted.length > 0) {
      deleteScanState(db, deleted);
    }

    backfillFirstTimestamps(db);
    const stats = computeStats(db, deviceJsonPath);

    const total = unchanged.size + toScan.length + deferred.length + deleted.length;
    log.info({ scanned, total, deferred: deferred.length, durationMs: Date.now() - startMs }, 'init scan complete');

    return { fileStates, stats, deferred };
  } finally {
    await sink.destroy();
  }
}
