import { statSync, watch, openSync, readSync, closeSync, type FSWatcher } from 'fs';
import { EventEmitter } from 'events';
import type { LogEntry, LogLevel } from '@claw-insights/shared';
import { config } from '../../config.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('log-tailer');

const SENSITIVE_PATTERN = /(?:token|key|secret|password|authorization)[=:]\s*.+/gi;

function redact(msg: string): string {
  return msg.replace(SENSITIVE_PATTERN, (match) => {
    const sep = match.includes('=') ? '=' : ':';
    const prefix = match.split(/[=:]/)[0];
    return `${prefix}${sep} ***`;
  });
}

function inferModule(raw: RawLogEntry): string {
  const msg = raw['0'] ?? '';
  const match = msg.match(/^\[(\w+(?:\/\w+)?)\]/);
  if (match) return match[1];
  const filePath = raw._meta?.path?.filePath ?? '';
  if (filePath.includes('cron')) return 'cron';
  if (filePath.includes('exec')) return 'tools';
  if (filePath.includes('agent')) return 'agent/embedded';
  return 'system';
}

function cleanMessage(msg: string): string {
  // Strip leading [module] tag since we extract it separately
  return msg.replace(/^\[\w+(?:\/\w+)?\]\s*/, '').trim();
}

interface RawLogEntry {
  '0'?: string;
  _meta?: {
    logLevelName?: string;
    path?: { filePath?: string };
  };
  time?: string;
}

function parseLogLine(line: string): LogEntry | null {
  try {
    const raw = JSON.parse(line) as RawLogEntry;
    const msg = raw['0'] ?? '';
    const levelStr = raw._meta?.logLevelName ?? 'INFO';
    const level = (['DEBUG', 'INFO', 'WARN', 'ERROR'].includes(levelStr) ? levelStr : 'INFO') as LogLevel;
    const time = raw.time ? (raw.time.split('T')[1]?.slice(0, 12) ?? '') : '';

    return {
      time,
      level,
      module: inferModule(raw),
      message: redact(cleanMessage(msg)),
    };
  } catch {
    return null;
  }
}

export class LogTailer extends EventEmitter {
  private logDir: string;
  private currentFile: string = '';
  private offset: number = 0;
  private watcher: FSWatcher | null = null;
  private dateCheckInterval: ReturnType<typeof setInterval> | null = null;
  private ringBuffer: LogEntry[] = [];
  private readonly ringSize = 200;

  constructor(logDir: string = config.logDir) {
    super();
    this.logDir = logDir;
    this.switchToCurrentFile();
    this.startDateCheck();
  }

  private getLogFileName(): string {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${this.logDir}openclaw-${yyyy}-${mm}-${dd}.log`;
  }

  private switchToCurrentFile() {
    const newFile = this.getLogFileName();
    if (newFile === this.currentFile) return;

    this.watcher?.close();
    this.currentFile = newFile;

    try {
      const stat = statSync(this.currentFile);
      this.offset = stat.size;
    } catch {
      this.offset = 0;
    }

    this.startWatching();
  }

  /** Read last N entries from ring buffer */
  getRecentEntries(count: number = 50): LogEntry[] {
    return this.ringBuffer.slice(-count);
  }

  private pollTimer: ReturnType<typeof setInterval> | null = null;

  private startWatching() {
    try {
      this.watcher = watch(this.currentFile, () => {
        this.readIncremental();
      });
    } catch {
      // File doesn't exist yet
    }
    // Polling fallback (fs.watch can be unreliable on macOS)
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.readIncremental(), 2000);
  }

  private readIncremental() {
    try {
      const stat = statSync(this.currentFile);
      // File truncated or rotated — reset offset
      if (stat.size < this.offset) {
        log.warn('file truncated/rotated, resetting offset');
        this.offset = 0;
      }
      if (stat.size === this.offset) return;

      const bytesToRead = stat.size - this.offset;
      const buf = Buffer.alloc(bytesToRead);
      const fd = openSync(this.currentFile, 'r');
      try {
        readSync(fd, buf, 0, bytesToRead, this.offset);
        this.offset = stat.size;
      } finally {
        closeSync(fd);
      }

      const chunk = buf.toString('utf-8');
      const lines = chunk.split('\n').filter((l) => l.trim());

      for (const line of lines) {
        const entry = parseLogLine(line);
        if (entry) {
          this.ringBuffer.push(entry);
          if (this.ringBuffer.length > this.ringSize) this.ringBuffer.shift();
          this.emit('log', entry);
        }
      }
    } catch (err) {
      log.warn({ err: err as Error }, 'read error');
    }
  }

  private startDateCheck() {
    this.dateCheckInterval = setInterval(() => {
      this.switchToCurrentFile();
    }, 60_000); // Check every minute
  }

  destroy() {
    this.watcher?.close();
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.dateCheckInterval) clearInterval(this.dateCheckInterval);
    this.removeAllListeners();
  }
}

export { parseLogLine, redact };
