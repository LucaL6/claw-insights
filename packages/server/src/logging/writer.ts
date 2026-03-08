import { mkdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

import pino from 'pino';

import type { LogLane, LogStream } from './types.js';

export interface WriterConfig {
  logDir: string;
  criticalFsyncMs: number;
  criticalSyncBatch: number;
  fileMode: number;
  rotationSizeMb: Record<LogStream, number>;
}

export const DEFAULT_WRITER_CONFIG: WriterConfig = {
  logDir: 'logs',
  criticalFsyncMs: 100,
  criticalSyncBatch: 1000,
  fileMode: 0o644,
  rotationSizeMb: { app: 64, debug: 64, error: 32 },
};

type PinoDestination = ReturnType<typeof pino.destination>;

interface StreamState {
  destination: PinoDestination | null;
  bytesWritten: number;
  entriesSinceSync: number;
  lastSyncAt: number;
  currentDate: string;
  seq: number;
  currentPath: string;
  sync: boolean;
}

export interface RotationEvent {
  stream: LogStream;
  steps: Array<'flush' | 'create'>;
}

export function formatLogFilename(stream: LogStream, date: string, seq: number): string {
  return `${stream}.${date}.${String(seq).padStart(4, '0')}.log`;
}

function todayDate(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

export class LogWriter {
  private readonly config: WriterConfig;
  private readonly states: Map<LogStream, StreamState> = new Map();
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  readonly shutdownOrder: Array<'drain' | 'fsync' | 'close'> = [];
  readonly rotationEvents: RotationEvent[] = [];

  constructor(config: Partial<WriterConfig> = {}) {
    this.config = { ...DEFAULT_WRITER_CONFIG, ...config };
    mkdirSync(this.config.logDir, { recursive: true });
  }

  start(): void {
    // Periodic flush for async streams (best effort). Critical stream is sync by policy.
    this.syncTimer = setInterval(() => {
      this.syncCriticalStreams();
    }, this.config.criticalFsyncMs);
    if (this.syncTimer && typeof this.syncTimer === 'object' && 'unref' in this.syncTimer) {
      this.syncTimer.unref();
    }
  }

  /** Append a serialized log line. Returns bytes written. */
  append(stream: LogStream, lane: LogLane, data: string): number {
    if (this.closed) {
      return 0;
    }

    let state = this.ensureStream(stream, lane);
    const line = `${data}\n`;
    const bytes = Buffer.byteLength(line, 'utf-8');

    const maxBytes = this.config.rotationSizeMb[stream] * 1024 * 1024;
    const today = todayDate();
    if (state.bytesWritten + bytes > maxBytes || state.currentDate !== today) {
      this.rotate(stream, state, today, lane);
      state = this.ensureStream(stream, lane);
    }

    state.destination?.write(line);
    state.bytesWritten += bytes;
    state.entriesSinceSync += 1;

    if (lane === 'critical' && state.entriesSinceSync >= this.config.criticalSyncBatch) {
      this.syncStream(state);
    }

    return bytes;
  }

  /** Get bytes written to a stream (for budget tracking). */
  bytesWritten(stream: LogStream): number {
    return this.states.get(stream)?.bytesWritten ?? 0;
  }

  /** Active segment paths (used by retention/reclaim to avoid deleting current files). */
  getActiveFilePaths(): Set<string> {
    const files = new Set<string>();
    for (const state of this.states.values()) {
      files.add(state.currentPath);
    }
    return files;
  }

  /** Test helper: effective sync mode for a stream destination. */
  streamSyncMode(stream: LogStream): boolean | null {
    return this.states.get(stream)?.sync ?? null;
  }

  /** Graceful shutdown: drain + sync all streams. */
  async shutdown(): Promise<void> {
    this.closed = true;
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    this.shutdownOrder.length = 0;
    this.shutdownOrder.push('drain');

    for (const state of this.states.values()) {
      if (state.entriesSinceSync > 0) {
        this.syncStream(state);
      }
    }
    this.shutdownOrder.push('fsync');

    const closes = [...this.states.values()].map((state) => this.closeDestination(state.destination));
    await Promise.all(closes);

    this.shutdownOrder.push('close');
    this.states.clear();
  }

  private ensureStream(stream: LogStream, lane: LogLane): StreamState {
    let state = this.states.get(stream);
    if (!state) {
      const date = todayDate();
      const seq = 1;
      const sync = this.syncModeFor(stream, lane);
      const filename = formatLogFilename(stream, date, seq);
      const filepath = join(this.config.logDir, filename);
      state = {
        destination: this.createDestination(filepath, sync),
        bytesWritten: this.safeFileSize(filepath),
        entriesSinceSync: 0,
        lastSyncAt: Date.now(),
        currentDate: date,
        seq,
        currentPath: filepath,
        sync,
      };
      this.states.set(stream, state);
    }
    return state;
  }

  private rotate(stream: LogStream, state: StreamState, newDate: string, lane: LogLane): void {
    const steps: Array<'flush' | 'create'> = [];

    this.flushDestination(state.destination);
    this.endDestination(state.destination);
    steps.push('flush');

    const seq = state.currentDate === newDate ? state.seq + 1 : 1;
    const filename = formatLogFilename(stream, newDate, seq);
    const filepath = join(this.config.logDir, filename);
    const sync = this.syncModeFor(stream, lane);

    state.destination = this.createDestination(filepath, sync);
    steps.push('create');

    state.bytesWritten = this.safeFileSize(filepath);
    state.entriesSinceSync = 0;
    state.lastSyncAt = Date.now();
    state.currentDate = newDate;
    state.seq = seq;
    state.currentPath = filepath;
    state.sync = sync;

    this.rotationEvents.push({ stream, steps });
  }

  private syncCriticalStreams(): void {
    const errorState = this.states.get('error');
    if (errorState && errorState.entriesSinceSync > 0) {
      this.syncStream(errorState);
    }
  }

  private syncStream(state: StreamState): void {
    this.flushDestination(state.destination);
    state.entriesSinceSync = 0;
    state.lastSyncAt = Date.now();
  }

  private createDestination(filePath: string, sync: boolean): PinoDestination {
    return pino.destination({
      dest: filePath,
      sync,
      mkdir: true,
      append: true,
      mode: this.config.fileMode,
      minLength: sync ? 0 : 4096,
    });
  }

  private syncModeFor(stream: LogStream, _lane: LogLane): boolean {
    // Stream-level policy is explicit and stable:
    // - error: sync (critical durability)
    // - app/debug: async (throughput)
    return stream === 'error';
  }

  private flushDestination(destination: PinoDestination | null): void {
    if (!destination) {
      return;
    }
    try {
      destination.flushSync();
    } catch {
      try {
        destination.flush();
      } catch {
        // best effort
      }
    }
  }

  private endDestination(destination: PinoDestination | null): void {
    if (!destination) {
      return;
    }
    try {
      destination.end();
    } catch {
      try {
        destination.destroy();
      } catch {
        // best effort
      }
    }
  }

  private async closeDestination(destination: PinoDestination | null): Promise<void> {
    if (!destination) {
      return;
    }

    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) {
          return;
        }
        done = true;
        resolve();
      };

      destination.once('close', finish);
      destination.once('error', finish);

      this.flushDestination(destination);
      this.endDestination(destination);

      setTimeout(finish, 100);
    });
  }

  private safeFileSize(filePath: string): number {
    try {
      return statSync(filePath).size;
    } catch {
      return 0;
    }
  }
}
