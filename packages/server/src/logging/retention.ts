/**
 * TTL sweeper – backstop retention cleanup (§6.3, §15).
 *
 * Periodically scans the log directory and removes segments older than
 * `retentionDays + graceHours`. Active segments are never deleted.
 */
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';

// Filename pattern: <stream>.<YYYY-MM-DD>.<seq>.log
const LOG_FILE_RE = /^(app|error|debug)\.(\d{4}-\d{2}-\d{2})\.(\d+)\.log$/;

export interface RetentionConfig {
  logDir: string;
  retentionDays: number; // 14
  sweepIntervalMs: number; // 600_000
  graceHours: number; // 1
}

export interface RetentionStats {
  lastSweepAt: number | null;
  filesScanned: number;
  filesDeleted: number;
  bytesReclaimed: number;
}

const DEFAULTS: RetentionConfig = {
  logDir: '',
  retentionDays: 14,
  sweepIntervalMs: 600_000,
  graceHours: 1,
};

export class RetentionSweeper {
  private readonly config: RetentionConfig;
  private timer: ReturnType<typeof setInterval> | null = null;
  private activeFiles = new Set<string>();
  private stats: RetentionStats = {
    lastSweepAt: null,
    filesScanned: 0,
    filesDeleted: 0,
    bytesReclaimed: 0,
  };

  constructor(config: Partial<RetentionConfig> & Pick<RetentionConfig, 'logDir'>) {
    this.config = { ...DEFAULTS, ...config };
  }

  /** Register currently-active segment paths (absolute) so they are never deleted. */
  setActiveFiles(files: Set<string> | string[]): void {
    this.activeFiles = new Set(files);
  }

  /** Parse a log filename and return its date, or null if not a log file. */
  static parseDateFromFilename(filename: string): Date | null {
    const m = LOG_FILE_RE.exec(filename);
    if (!m) {
      return null;
    }
    const d = new Date(m[2] + 'T00:00:00Z');
    return Number.isNaN(d.getTime()) ? null : d;
  }

  /** Return the cutoff timestamp: files dated before this are expired. */
  private cutoff(now: number = Date.now()): number {
    const ms = this.config.retentionDays * 24 * 60 * 60 * 1000 + this.config.graceHours * 60 * 60 * 1000;
    return now - ms;
  }

  /** Run a single sweep. Exported for testing. */
  async sweep(now: number = Date.now()): Promise<RetentionStats> {
    const cutoff = this.cutoff(now);
    let filesScanned = 0;
    let filesDeleted = 0;
    let bytesReclaimed = 0;

    let entries: string[];
    try {
      entries = await readdir(this.config.logDir);
    } catch {
      // Directory missing – nothing to sweep.
      this.stats = { lastSweepAt: now, filesScanned: 0, filesDeleted: 0, bytesReclaimed: 0 };
      return { ...this.stats };
    }

    for (const entry of entries) {
      const fileDate = RetentionSweeper.parseDateFromFilename(entry);
      if (!fileDate) {
        continue;
      }

      filesScanned++;
      const fullPath = join(this.config.logDir, entry);

      // Never delete active segments.
      if (this.activeFiles.has(fullPath)) {
        continue;
      }

      if (fileDate.getTime() < cutoff) {
        try {
          const info = await stat(fullPath);
          await unlink(fullPath);
          filesDeleted++;
          bytesReclaimed += info.size;
        } catch {
          // File may have been removed concurrently – ignore.
        }
      }
    }

    this.stats = { lastSweepAt: now, filesScanned, filesDeleted, bytesReclaimed };
    return { ...this.stats };
  }

  getStats(): RetentionStats {
    return { ...this.stats };
  }

  start(): void {
    if (this.timer) {
      return;
    }
    // Run first sweep immediately, then on interval.
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), this.config.sweepIntervalMs);
    // Allow the process to exit even if the timer is active.
    if (this.timer && typeof this.timer === 'object' && 'unref' in this.timer) {
      this.timer.unref();
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
