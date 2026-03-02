import { readdir,stat } from 'node:fs/promises';
import { basename, join } from 'node:path';

import { createChildLogger } from '../../../logger.js';
import type { FileState, FileTask } from './types.js';

const log = createChildLogger('transcript-watch');

// ── Public types ──

export interface WatcherOptions {
  dir: string;
  fileStates: Map<string, FileState>;
  processTask: (task: FileTask) => Promise<FileState>;
  pollIntervalMs?: number;        // default 10_000
  dirScanIntervalMs?: number;     // default 60_000
  byteBudgetPerTick?: number;     // default 256KB
}

export interface TranscriptWatcher {
  destroy(): void;
}

// ── createPollLoop ──

function createPollLoop(fn: () => Promise<void>, intervalMs: number, label: string) {
  let destroyed = false;
  let timerId: ReturnType<typeof setTimeout>;

  async function tick() {
    try {
      await fn();
    } catch (err) {
      log.warn({ err, label }, 'poll error');
    } finally {
      if (!destroyed) {timerId = setTimeout(() => void tick(), intervalMs);}
    }
  }

  timerId = setTimeout(() => void tick(), 0);

  return {
    destroy() {
      destroyed = true;
      clearTimeout(timerId);
    },
  };
}

// ── createWatcher ──

export function createWatcher(opts: WatcherOptions): TranscriptWatcher {
  const {
    dir,
    fileStates,
    processTask,
    pollIntervalMs = 10_000,
    dirScanIntervalMs = 60_000,
    byteBudgetPerTick = 256 * 1024,
  } = opts;

  let roundRobinIndex = 0;

  // ── poll ──
  async function poll() {
    const start = Date.now();
    const paths = Array.from(fileStates.keys());
    if (paths.length === 0) {
      log.debug({ pollTickMs: Date.now() - start }, 'poll tick (no files)');
      return;
    }

    let budgetRemaining = byteBudgetPerTick;
    const startIdx = roundRobinIndex % paths.length;
    let idx = startIdx;
    let processed = 0;

    do {
      if (budgetRemaining <= 0) {break;}

      const path = paths[idx];
      const state = fileStates.get(path);
      if (!state) {
        idx = (idx + 1) % paths.length;
        if (idx === startIdx) {break;}
        continue;
      }

      // async stat for truncate detection
      let st: Awaited<ReturnType<typeof stat>>;
      try {
        st = await stat(path);
      } catch (err) {
        // file may have been deleted between dirScan ticks
        log.debug({ file: basename(path), err }, 'stat failed during poll');
        idx = (idx + 1) % paths.length;
        if (idx === startIdx) {break;}
        continue;
      }

      let taskOffset = state.offset;
      let taskPartial = state.partial;

      // truncate / rotate detection
      if (st.ino !== state.inode || st.birthtimeMs !== state.birthtimeMs || st.size < state.offset) {
        log.info({ file: basename(path), reason: st.ino !== state.inode ? 'inode' : 'truncate' }, 'file reset detected');
        taskOffset = 0;
        taskPartial = '';
        state.inode = st.ino;
        state.birthtimeMs = st.birthtimeMs;
        state.partial = '';
        state.offset = 0;
      }

      // no new data → skip
      if (st.size <= taskOffset) {
        idx = (idx + 1) % paths.length;
        if (idx === startIdx) {break;}
        continue;
      }

      const sessionKey = basename(path, '.jsonl');
      const task: FileTask = {
        path,
        offset: taskOffset,
        partial: taskPartial,
        sessionKey,
        prevFirstTimestampMs: state.firstTimestampMs,
        inode: state.inode,
        birthtimeMs: state.birthtimeMs,
      };

      const newState = await processTask(task);
      fileStates.set(path, newState);
      budgetRemaining -= (newState.offset - taskOffset);
      processed++;

      idx = (idx + 1) % paths.length;
      if (idx === startIdx) {break;}
    } while (true); // eslint-disable-line no-constant-condition

    roundRobinIndex = idx;
    log.debug({ pollTickMs: Date.now() - start, processed }, 'poll tick');
  }

  // ── dirScan ──
  async function dirScan() {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }

    const jsonlFiles = entries.filter((f) => f.endsWith('.jsonl'));
    const currentPaths = new Set(jsonlFiles.map((f) => join(dir, f)));

    // discover new files
    for (const f of jsonlFiles) {
      const path = join(dir, f);
      if (!fileStates.has(path)) {
        try {
          const st = await stat(path);
          fileStates.set(path, {
            offset: 0,
            inode: st.ino,
            birthtimeMs: st.birthtimeMs,
            mtimeMs: st.mtimeMs,
            partial: '',
            firstTimestampMs: null,
          });
          log.info({ file: f }, 'discovered new transcript file');
        } catch {
          log.warn({ file: f }, 'failed to stat new file');
        }
      }
    }

    // remove deleted
    for (const path of fileStates.keys()) {
      if (!currentPaths.has(path)) {
        fileStates.delete(path);
        log.info({ file: basename(path) }, 'transcript file removed');
      }
    }
  }

  // ── start loops ──
  const pollLoop = createPollLoop(poll, pollIntervalMs, 'poll');
  const dirScanLoop = createPollLoop(dirScan, dirScanIntervalMs, 'dirScan');

  log.info({ dir, fileCount: fileStates.size, pollIntervalMs, dirScanIntervalMs }, 'transcript watcher started');

  return {
    destroy() {
      pollLoop.destroy();
      dirScanLoop.destroy();
      log.info('transcript watcher destroyed');
    },
  };
}
