import { basename } from 'node:path';

import type { Database } from '../../../db/database.js';
import type { MessageEventBus } from '../../../events/message-event-bus.js';
import type { TokenEventBus } from '../../../events/token-event-bus.js';
import { createChildLogger } from '../../../logger.js';
import { initScan } from './init.js';
import { type AggregatedStats, backfillFirstTimestamps, computeStats, emptyStats, formatStats, type LifetimeStatsResult } from './persistence/lifetime-stats.js';
import { BATCH_FLUSH, createTranscriptSink, WATCH_FLUSH } from './persistence/sink.js';
import { createFileProcessor } from './processing/file-processor.js';
import { processFile } from './processing/processor.js';
import type { FileState, FileTask, OnFlushHook, TranscriptSink } from './types.js';
import { createWatcher, type TranscriptWatcher } from './watch.js';

const log = createChildLogger('transcript-manager');

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

const DEFERRED_DELAY_MS = 30_000;

export type ManagerState =
  | { kind: 'idle' }
  | { kind: 'initializing' }
  | { kind: 'ready'; deferredPending: boolean }
  | { kind: 'complete' }
  | { kind: 'destroyed' };

export interface TranscriptManager {
  readonly state: ManagerState;
  init(): Promise<void>;
  getStats(): LifetimeStatsResult;
  getFileStates(): Map<string, FileState>;
  isReady(): boolean;
  destroy(): void;
}

export interface TranscriptManagerDeps {
  db: Database;
  transcriptsDir: string;
  deviceJsonPath: string;
  tokenBus?: TokenEventBus;
  messageBus?: MessageEventBus;
  onFlush?: OnFlushHook;
}

export function createTranscriptManager(deps: TranscriptManagerDeps): TranscriptManager {
  let state: ManagerState = { kind: 'idle' };
  let cachedStats: AggregatedStats = emptyStats();
  let initialScanDone = false;
  let fileStates: Map<string, FileState> = new Map();
  let watcher: TranscriptWatcher | null = null;
  let watchSink: TranscriptSink | null = null;
  let deferredAbort: AbortController | null = null;

  const manager: TranscriptManager = {
    get state() {
      return state;
    },

    async init(): Promise<void> {
      if (state.kind !== 'idle') {
        throw new Error(`TranscriptManager.init() called in state '${state.kind}', expected 'idle'`);
      }
      state = { kind: 'initializing' };

      // 1. Create initSink + initProcessor, run initScan
      const initSink = createTranscriptSink(
        { db: deps.db, tokenBus: deps.tokenBus, messageBus: deps.messageBus, onFlush: deps.onFlush },
        BATCH_FLUSH,
      );

      const result = await initScan({
        db: deps.db,
        transcriptsDir: deps.transcriptsDir,
        deviceJsonPath: deps.deviceJsonPath,
        sink: initSink,
        process: processFile,
      });

      // initSink is destroyed inside initScan's finally block

      fileStates = result.fileStates;
      cachedStats = result.stats;
      initialScanDone = true;

      // 2. Create watchSink + watchProcessor + watcher
      watchSink = createTranscriptSink(
        { db: deps.db, tokenBus: deps.tokenBus, messageBus: deps.messageBus, onFlush: deps.onFlush },
        WATCH_FLUSH,
      );

      const watchProcessor = createFileProcessor({
        process: processFile,
        sink: watchSink,
      });

      watcher = createWatcher({
        dir: deps.transcriptsDir,
        fileStates,
        processTask: watchProcessor,
      });

      // 3. Handle deferred
      if (result.deferred.length > 0) {
        state = { kind: 'ready', deferredPending: true };
        deferredAbort = new AbortController();
        void runDeferred(result.deferred, watchProcessor, deferredAbort.signal).catch((err) => {
          log.error({ err }, 'deferred scan failed unexpectedly');
        });
      } else {
        state = { kind: 'complete' };
      }
    },

    getStats(): LifetimeStatsResult {
      return formatStats(cachedStats, initialScanDone);
    },

    getFileStates(): Map<string, FileState> {
      return fileStates;
    },

    isReady(): boolean {
      return state.kind === 'ready' || state.kind === 'complete';
    },

    destroy(): void {
      if (state.kind === 'destroyed') {return;}
      state = { kind: 'destroyed' };
      deferredAbort?.abort();
      watcher?.destroy();
      void watchSink?.destroy();
    },
  };

  async function runDeferred(
    deferred: Array<{ path: string }>,
    processTask: (task: FileTask) => Promise<FileState>,
    signal: AbortSignal,
  ): Promise<void> {
    const startMs = Date.now();
    try {
      await delay(DEFERRED_DELAY_MS);
      if (signal.aborted) {return;}

      for (const file of deferred) {
        if (signal.aborted) {return;}

        const existing = fileStates.get(file.path);
        const task: FileTask = {
          path: file.path,
          offset: existing?.offset ?? 0,
          partial: existing?.partial ?? '',
          sessionKey: basename(file.path, '.jsonl'),
          prevFirstTimestampMs: existing?.firstTimestampMs ?? null,
          inode: existing?.inode,
          birthtimeMs: existing?.birthtimeMs,
        };

        try {
          const newState = await processTask(task);
          fileStates.set(file.path, newState);
        } catch (err) {
          log.warn({ file: basename(file.path), err }, 'deferred scan file failed');
        }
      }

      if (signal.aborted) {return;}

      await watchSink?.flush();
      backfillFirstTimestamps(deps.db);
      cachedStats = computeStats(deps.db, deps.deviceJsonPath);

      log.info({ deferred: deferred.length, durationMs: Date.now() - startMs }, 'deferred scan complete');

      if (state.kind !== 'destroyed') {
        state = { kind: 'complete' };
      }
    } catch (err) {
      log.warn({ err }, 'deferred scan failed');
    }
  }

  return manager;
}
