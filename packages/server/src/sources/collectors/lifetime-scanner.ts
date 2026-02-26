import { closeSync, existsSync, openSync, readdirSync, readFileSync, readSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

import type { TokenEventBus } from '../../events/token-event-bus.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('lifetime-scanner');

// ── Types ──

export interface FileState {
  offset: number;
  inode: number;
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

export interface NormalizedUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
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
  private refreshPromise: Promise<void> | null = null;
  private lastRefreshMs = 0;
  private unrecognizedUsageCount = 0;
  private destroyed = false;

  static REFRESH_COOLDOWN_MS = 5_000;

  constructor(
    private transcriptsDir: string,
    private deviceJsonPath: string,
    private tokenBus?: TokenEventBus,
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
      this.scanAll();
      this.stats.createdAtMs = this.resolveCreatedAt();
      this.initialScanDone = true;
      this.lastRefreshMs = Date.now();
      log.info({ fileCount: this.fileStates.size, durationMs: Date.now() - startMs }, 'lifetime scan complete');
    } catch (err) {
      log.error({ err }, 'lifetime scan failed');
    }
  }

  async getStats(): Promise<LifetimeStatsResult> {
    await this.guardedRefresh();
    return this.toResult();
  }

  destroy(): void {
    this.destroyed = true;
    this.fileStates.clear();
    this.stats = LifetimeScanner.emptyStats();
    this.refreshPromise = null;
    this.lastRefreshMs = 0;
    this.initialScanDone = false;
    this.unrecognizedUsageCount = 0;
  }

  // ── Internal: full scan ──

  private scanAll(): void {
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

    for (const file of files) {
      this.scanFile(file);
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
        if (line.trim()) {
          this.parseLine(line, sessionKey);
        }
      }
      // offset = end of file (we store partial separately for incremental join)
      this.fileStates.set(file, { offset: st.size, inode: st.ino, partialLine: partial });
    } catch (err) {
      log.warn({ file, err }, 'failed to scan transcript file');
    }
  }

  // ── Internal: incremental refresh ──

  private async guardedRefresh(): Promise<void> {
    if (this.destroyed) {
      return;
    }
    if (Date.now() - this.lastRefreshMs < LifetimeScanner.REFRESH_COOLDOWN_MS) {
      return;
    }
    if (this.refreshPromise) {
      return this.refreshPromise;
    }
    this.refreshPromise = this.refresh().finally(() => {
      this.refreshPromise = null;
      this.lastRefreshMs = Date.now();
    });
    return this.refreshPromise;
  }

   
  private async refresh(): Promise<void> {
    if (!existsSync(this.transcriptsDir)) {
      return;
    }

    const currentFiles = new Set(
      readdirSync(this.transcriptsDir)
        .filter((f) => f.endsWith('.jsonl'))
        .map((f) => join(this.transcriptsDir, f)),
    );

    // Remove deleted files from state
    for (const [file] of this.fileStates) {
      if (!currentFiles.has(file)) {
        this.fileStates.delete(file);
        log.info({ file: basename(file) }, 'transcript file removed, clearing state');
      }
    }

    // Update session count to current file count
    this.stats.totalSessions = currentFiles.size;

    for (const file of currentFiles) {
      const saved = this.fileStates.get(file);
      if (!saved) {
        // New file — full scan
        this.scanFile(file);
        continue;
      }

      try {
        const st = statSync(file);
        // Detect truncate / inode change → full rescan
        // We don't track per-file contributions, so any inode/truncate
        // invalidates incremental state. Full rescan is safe and rare.
        if (st.ino !== saved.inode || st.size < saved.offset) {
          log.info(
            {
              file: basename(file),
              reason: st.ino !== saved.inode ? 'inode' : 'truncate',
            },
            'file changed, triggering full rescan',
          );
          this.scanAll();
          this.stats.createdAtMs = this.resolveCreatedAt();
          return; // scanAll already processed everything
        }

        // No new bytes
        if (st.size === saved.offset && saved.partialLine === '') {
          continue;
        }

        // Read new bytes from offset
        if (st.size > saved.offset) {
          const newBytesLen = st.size - saved.offset;
          const buf = Buffer.alloc(newBytesLen);
          const fd = openSync(file, 'r');
          try {
            readSync(fd, buf, 0, newBytesLen, saved.offset);
          } finally {
            closeSync(fd);
          }
          this.processIncremental(saved, buf, st.ino, basename(file, '.jsonl'));
        }
      } catch (err) {
        log.warn({ file: basename(file), err }, 'failed to refresh transcript');
      }
    }
  }

  private processIncremental(state: FileState, newBytes: Buffer, currentInode: number, sessionKey: string): void {
    const text = state.partialLine + newBytes.toString('utf-8');
    const lines = text.split('\n');
    // Last element: '' if ends with \n, or partial
    const partial = text.endsWith('\n') ? '' : (lines.pop() ?? '');

    for (const line of lines) {
      if (line.trim()) {
        this.parseLine(line, sessionKey);
      }
    }

    // offset advances by the raw new bytes (not including the old partial we prepended)
    state.offset += newBytes.length;
    state.partialLine = partial;
    state.inode = currentInode;
  }

  // ── Internal: line parsing ──

  private parseLine(raw: string, sessionKey?: string): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(raw);
    } catch {
      log.debug('skipping malformed JSON line');
      return;
    }

    if (parsed.type !== 'message') {
      return;
    }

    const message = parsed.message as Record<string, unknown> | undefined;
    if (!message) {
      return;
    }

    const role = message.role;
    if (role === 'user') {
      this.stats.totalUserMessages++;
    } else if (role === 'assistant') {
      this.stats.totalAssistantMessages++;
      const usage = this.normalizeUsage(
        (message.usage as Record<string, unknown>) ?? (parsed.usage as Record<string, unknown>),
      );
      if (usage) {
        this.stats.totalInputTokens += usage.input;
        this.stats.totalOutputTokens += usage.output;
        this.stats.totalCacheReadTokens += usage.cacheRead;
        this.stats.totalCacheWriteTokens += usage.cacheWrite;

        if (this.tokenBus && sessionKey) {
          const ts = parsed.timestamp as string | undefined;
          const model = message.model as string | undefined;
          if (!ts) {
            log.warn({ sessionKey }, 'skipping token event: missing timestamp');
          } else if (!model) {
            log.warn({ sessionKey, timestamp: ts }, 'skipping token event: missing model');
          } else {
            this.tokenBus.emit({
              timestamp: ts,
              sessionKey,
              model,
              inputTokens: usage.input,
              outputTokens: usage.output,
              cacheReadTokens: usage.cacheRead,
              cacheWriteTokens: usage.cacheWrite,
            });
          }
        }
      }
    }
  }

  // ── Internal: usage normalization ──

  normalizeUsage(raw: unknown): NormalizedUsage | null {
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const r = raw as Record<string, unknown>;

    const input = toNum(r.input ?? r.inputTokens ?? r.prompt_tokens ?? r.input_tokens);
    const output = toNum(r.output ?? r.outputTokens ?? r.completion_tokens ?? r.output_tokens);
    const cacheRead = toNum(r.cacheRead ?? r.cache_read_input_tokens);
    const cacheWrite = toNum(r.cacheWrite ?? r.cache_creation_input_tokens);

    if (input === 0 && output === 0 && Object.keys(r).length > 0) {
      this.unrecognizedUsageCount++;
      if (this.unrecognizedUsageCount <= 5) {
        log.warn({ keys: Object.keys(r) }, 'unrecognized usage format');
      }
    }

    return { input, output, cacheRead, cacheWrite };
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

function toNum(val: unknown): number {
  if (typeof val === 'number' && Number.isFinite(val)) {
    return val;
  }
  return 0;
}

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
