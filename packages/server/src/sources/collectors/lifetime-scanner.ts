import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { MessageEventBus } from '../../events/message-event-bus.js';
import type { TokenEventBus } from '../../events/token-event-bus.js';
import { createChildLogger } from '../../logger.js';
import { createUsageNormalizer, parseLine } from './transcript-parser.js';

const log = createChildLogger('lifetime-scanner');

/** Number of files to process before yielding to the event loop. */
const YIELD_BATCH_SIZE = 30;

// ── Types ──

export interface FileState {
  offset: number;
  inode: number;
  birthtimeMs: number;
  partialLine: string;
}

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

// ── Scanner ──

export class LifetimeScanner {
  private fileStates = new Map<string, FileState>();
  private stats: AggregatedStats = LifetimeScanner.emptyStats();
  private initialScanDone = false;
  private destroyed = false;
  private normalize = createUsageNormalizer();

  constructor(
    private transcriptsDir: string,
    private deviceJsonPath: string,
    private tokenBus?: TokenEventBus,
    private messageBus?: MessageEventBus,
  ) {}

  // ── Lifecycle ──

  async init(): Promise<void> {
    // Yield to event loop so server startup isn't blocked by synchronous I/O
    await new Promise<void>((resolve) => {
      setImmediate(resolve);
    });
    if (this.destroyed) {
      return;
    }
    const startMs = Date.now();
    try {
      await this.scanAll();
      if (this.destroyed) {
        return;
      }
      this.stats.createdAtMs = this.resolveCreatedAt();
      this.initialScanDone = true;
      log.info({ fileCount: this.fileStates.size, durationMs: Date.now() - startMs }, 'lifetime scan complete');
    } catch (err) {
      log.error({ err }, 'lifetime scan failed');
    }
  }

  // Keep async for API compatibility — callers await this.
  // eslint-disable-next-line @typescript-eslint/require-await
  async getStats(): Promise<LifetimeStatsResult> {
    return this.toResult();
  }

  /** Returns a snapshot of file states for handoff to TranscriptWatcher. */
  getFileStates(): Map<string, FileState> {
    return new Map(this.fileStates);
  }

  destroy(): void {
    this.destroyed = true;
    this.fileStates.clear();
    this.stats = LifetimeScanner.emptyStats();
    this.initialScanDone = false;
  }

  // ── Internal: full scan ──

  private async scanAll(): Promise<void> {
    if (!existsSync(this.transcriptsDir)) {
      log.warn({ path: this.transcriptsDir }, 'transcripts directory not found');
      return;
    }
    const files = readdirSync(this.transcriptsDir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => join(this.transcriptsDir, f));

    this.stats = LifetimeScanner.emptyStats();
    this.stats.totalSessions = files.length;
    this.fileStates.clear();

    for (let i = 0; i < files.length; i++) {
      this.scanFile(files[i]);
      // Yield to event loop periodically so other async work (CLI calls, HTTP) can proceed
      if ((i + 1) % YIELD_BATCH_SIZE === 0) {
        await new Promise<void>((resolve) => {
          setImmediate(resolve);
        });
        if (this.destroyed) {
          return;
        }
      }
    }
  }

  private scanFile(file: string): void {
    try {
      const st = statSync(file);
      const content = readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      // Last element after split: '' if file ends with \n, or partial line
      const partial = content.endsWith('\n') ? '' : (lines.pop() ?? '');
      const sessionKey = basename(file, '.jsonl');
      for (const line of lines) {
        if (!line.trim()) {
          continue;
        }

        const result = parseLine(line, sessionKey, this.normalize);
        if (!result) {
          continue;
        }

        if (result.userMessages) {
          this.stats.totalUserMessages += result.userMessages;
        }
        if (result.assistantMessages) {
          this.stats.totalAssistantMessages += result.assistantMessages;
        }
        if (result.usage) {
          this.stats.totalInputTokens += result.usage.input;
          this.stats.totalOutputTokens += result.usage.output;
          this.stats.totalCacheReadTokens += result.usage.cacheRead;
          this.stats.totalCacheWriteTokens += result.usage.cacheWrite;
        }
        if (result.token && this.tokenBus) {
          this.tokenBus.emit(result.token);
        }
        if (result.message && this.messageBus) {
          this.messageBus.emit(result.message);
        }
      }
      // offset = end of file (we store partial separately for incremental join)
      this.fileStates.set(file, { offset: st.size, inode: st.ino, birthtimeMs: st.birthtimeMs, partialLine: partial });
    } catch (err) {
      log.warn({ file, err }, 'failed to scan transcript file');
    }
  }

  // ── Internal: createdAt ──

  private resolveCreatedAt(): number {
    let deviceMs = Infinity;
    try {
      if (existsSync(this.deviceJsonPath)) {
        const device = JSON.parse(readFileSync(this.deviceJsonPath, 'utf-8'));
        deviceMs = typeof device.createdAtMs === 'number' ? device.createdAtMs : Infinity;
      }
    } catch {
      log.warn('failed to read device.json for createdAt');
    }

    let earliestMs = Infinity;
    for (const file of this.fileStates.keys()) {
      const ts = readFirstTimestamp(file);
      if (ts !== null && ts > 0 && ts < Date.now() + 86_400_000) {
        earliestMs = Math.min(earliestMs, ts);
      }
    }

    if (earliestMs < Infinity) {
      return Math.min(deviceMs, earliestMs);
    }
    if (deviceMs < Infinity) {
      return deviceMs;
    }
    return Date.now();
  }

  // ── Internal: output ──

  private toResult(): LifetimeStatsResult {
    const s = this.stats;
    const now = Date.now();
    const createdMs = s.createdAtMs || now;
    return {
      isReady: this.initialScanDone,
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

  static emptyStats(): AggregatedStats {
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
}

// ── Helpers ──

/**
 * Scan up to MAX_LINES lines in a file searching for the first parseable timestamp.
 * Returns epoch ms or null if none found.
 */
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
        /* skip unparseable line */
      }
    }
    return null;
  } finally {
    closeSync(fd);
  }
}
