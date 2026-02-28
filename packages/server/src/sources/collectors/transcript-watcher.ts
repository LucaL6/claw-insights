import { closeSync, existsSync, openSync, readdirSync, readSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { MessageEventBus } from '../../events/message-event-bus.js';
import type { TokenEventBus } from '../../events/token-event-bus.js';
import { createChildLogger } from '../../logger.js';
import type { FileState } from './lifetime-scanner.js';
import { createUsageNormalizer, parseLine } from './transcript-parser.js';

const log = createChildLogger('transcript-watcher');

// ── Config ──

interface WatcherConfig {
  dir: string;
  pollIntervalMs: number;
  dirScanIntervalMs: number;
  byteBudgetPerTick: number;
  tokenBus: TokenEventBus | null;
  messageBus: MessageEventBus | null;
  onFlush: (() => void) | null;
}

// ── Builder (functional + chainable) ──

export interface TranscriptWatcherBuilder {
  pollEvery(ms: number): TranscriptWatcherBuilder;
  dirScanEvery(ms: number): TranscriptWatcherBuilder;
  byteBudget(bytes: number): TranscriptWatcherBuilder;
  emitTo(tokenBus: TokenEventBus, messageBus: MessageEventBus): TranscriptWatcherBuilder;
  onFlush(fn: () => void): TranscriptWatcherBuilder;
  start(fileStates: Map<string, FileState>): TranscriptWatcher;
}

export interface TranscriptWatcher {
  destroy(): void;
}

export function createTranscriptWatcher(dir: string): TranscriptWatcherBuilder {
  const config: WatcherConfig = {
    dir,
    pollIntervalMs: 10_000,
    dirScanIntervalMs: 60_000,
    byteBudgetPerTick: 256 * 1024, // 256 KB
    tokenBus: null,
    messageBus: null,
    onFlush: null,
  };

  const builder: TranscriptWatcherBuilder = {
    pollEvery(ms) {
      config.pollIntervalMs = ms;
      return builder;
    },
    dirScanEvery(ms) {
      config.dirScanIntervalMs = ms;
      return builder;
    },
    byteBudget(bytes) {
      config.byteBudgetPerTick = bytes;
      return builder;
    },
    emitTo(tokenBus, messageBus) {
      config.tokenBus = tokenBus;
      config.messageBus = messageBus;
      return builder;
    },
    onFlush(fn) {
      config.onFlush = fn;
      return builder;
    },
    start(fileStates) {
      if (!config.tokenBus || !config.messageBus) {
        throw new Error('TranscriptWatcher: emitTo(tokenBus, messageBus) must be called before start()');
      }
      if (!existsSync(config.dir)) {
        log.warn({ dir: config.dir }, 'transcripts directory not found at start');
      }
      return startWatcher(config, fileStates);
    },
  };

  return builder;
}

// ── Internal: watcher runtime ──

function startWatcher(cfg: WatcherConfig, initialStates: Map<string, FileState>): TranscriptWatcher {
  const fileStates = new Map(initialStates); // clone to own
  const normalize = createUsageNormalizer(); // instance-scoped warn counter
  let roundRobinIndex = 0;
  let destroyed = false;

  // ── Poll: read new bytes from known files (round-robin, budget-capped) ──
  function poll(): void {
    if (destroyed) {
      return;
    }
    const paths = Array.from(fileStates.keys());
    if (paths.length === 0) {
      return;
    }

    let bytesRead = 0;
    const startIdx = roundRobinIndex % paths.length;
    let i = startIdx;

    do {
      if (bytesRead >= cfg.byteBudgetPerTick) {
        break;
      }

      const path = paths[i];
      const state = fileStates.get(path);
      if (!state) {
        i = (i + 1) % paths.length;
        if (i === startIdx) {
          break;
        }
        continue;
      }
      try {
        const st = statSync(path);

        // Detect truncate / inode change → reset offset
        if (st.ino !== state.inode || st.size < state.offset || st.birthtimeMs !== state.birthtimeMs) {
          log.info(
            { file: basename(path), reason: st.ino !== state.inode ? 'inode' : 'truncate' },
            'file reset detected',
          );
          state.offset = 0;
          state.inode = st.ino;
          state.birthtimeMs = st.birthtimeMs;
          state.partialLine = '';
        }

        if (st.size <= state.offset) {
          i = (i + 1) % paths.length;
          if (i === startIdx) {
            break;
          }
          continue;
        }

        const toRead = Math.min(st.size - state.offset, cfg.byteBudgetPerTick - bytesRead);
        const buf = Buffer.alloc(toRead);
        const fd = openSync(path, 'r');
        try {
          readSync(fd, buf, 0, toRead, state.offset);
        } finally {
          closeSync(fd);
        }

        const text = state.partialLine + buf.toString('utf-8');
        const lines = text.split('\n');
        const partial = text.endsWith('\n') ? '' : (lines.pop() ?? '');

        const sessionKey = basename(path, '.jsonl');
        for (const line of lines) {
          if (line.trim()) {
            const result = parseLine(line, sessionKey, normalize);
            if (result) {
              if (result.token && cfg.tokenBus) {
                cfg.tokenBus.emit(result.token);
              }
              if (result.message && cfg.messageBus) {
                cfg.messageBus.emit(result.message);
              }
            }
          }
        }

        state.offset += buf.length;
        state.partialLine = partial;
        state.inode = st.ino;
        bytesRead += toRead;
      } catch (err) {
        log.warn({ file: basename(path), err }, 'poll read error');
      }

      i = (i + 1) % paths.length;
      if (i === startIdx) {
        break;
      }
      // eslint-disable-next-line no-constant-condition
    } while (true);

    roundRobinIndex = i;

    // Flush after each poll tick
    cfg.onFlush?.();
  }

  // ── Dir scan: discover new files ──
  function dirScan(): void {
    if (destroyed) {
      return;
    }
    if (!existsSync(cfg.dir)) {
      return;
    }

    try {
      const current = readdirSync(cfg.dir)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => join(cfg.dir, f));

      for (const path of current) {
        if (!fileStates.has(path)) {
          try {
            const st = statSync(path);
            fileStates.set(path, {
              offset: 0, // Start from beginning for new files
              inode: st.ino,
              birthtimeMs: st.birthtimeMs,
              partialLine: '',
            });
            log.info({ file: basename(path) }, 'discovered new transcript file');
          } catch (err) {
            log.warn({ file: basename(path), err }, 'failed to stat new file');
          }
        }
      }

      // Remove deleted files
      const currentSet = new Set(current);
      for (const path of fileStates.keys()) {
        if (!currentSet.has(path)) {
          fileStates.delete(path);
          log.info({ file: basename(path) }, 'transcript file removed');
        }
      }
    } catch (err) {
      log.warn({ err }, 'dir scan error');
    }
  }

  // ── Start intervals ──
  const pollTimer = setInterval(poll, cfg.pollIntervalMs);
  const dirScanTimer = setInterval(dirScan, cfg.dirScanIntervalMs);

  log.info(
    { fileCount: fileStates.size, pollMs: cfg.pollIntervalMs, dirScanMs: cfg.dirScanIntervalMs },
    'transcript watcher started',
  );

  return {
    destroy() {
      destroyed = true;
      clearInterval(pollTimer);
      clearInterval(dirScanTimer);
      cfg.onFlush?.(); // Final flush
      log.info('transcript watcher destroyed');
    },
  };
}
