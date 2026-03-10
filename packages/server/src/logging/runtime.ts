import { readdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { format } from 'node:util';

import { BudgetGate } from './budget-gate.js';
import { RetentionSweeper } from './retention.js';
import { LogRouter } from './router.js';
import { deterministicSampleDecision } from './sampling.js';
import type { LoggingRuntimeState } from './state.js';
import type { LogLane, LogStream } from './types.js';
import { LogWriter } from './writer.js';

function env(key: string): string | undefined {
  return process.env[`CLAW_INSIGHTS_${key}`] ?? process.env[`OPENCLAW_${key}`];
}

function safeInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) ? n : fallback;
}

export type MethodLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

function levelToLayeredLevel(level: MethodLevel): 'debug' | 'info' | 'warn' | 'error' {
  switch (level) {
    case 'trace':
      return 'debug';
    case 'fatal':
      return 'error';
    default:
      return level;
  }
}

interface NormalizedLogInput {
  msg: string;
  meta: Record<string, unknown>;
}

function normalizeLogInput(args: unknown[]): NormalizedLogInput {
  if (args.length === 0) {
    return { msg: '', meta: {} };
  }

  const [first, second, ...rest] = args;

  if (typeof first === 'string') {
    return { msg: format(first, second, ...rest), meta: {} };
  }

  if (first instanceof Error) {
    const message = typeof second === 'string' ? format(second, ...rest) : first.message;
    return {
      msg: message,
      meta: {
        err: {
          name: first.name,
          message: first.message,
          stack: first.stack,
        },
      },
    };
  }

  if (typeof first === 'object' && first !== null && !Array.isArray(first)) {
    const msg = typeof second === 'string' ? format(second, ...rest) : '';
    return { msg, meta: first as Record<string, unknown> };
  }

  return {
    msg: args
      .map((v) => {
        if (typeof v === 'string') {
          return v;
        }
        try {
          return JSON.stringify(v);
        } catch {
          return String(v);
        }
      })
      .join(' '),
    meta: {},
  };
}

interface ParsedSegment {
  stream: LogStream;
  date: string;
  seq: number;
  fullPath: string;
}

const SEGMENT_RE = /^(app|error|debug|noise|security|access)\.(\d{4}-\d{2}-\d{2})\.(\d+)\.log$/;

function parseSegment(logDir: string, name: string): ParsedSegment | null {
  const m = SEGMENT_RE.exec(name);
  if (!m) {
    return null;
  }
  const stream = m[1] as LogStream;
  const date = m[2];
  const seq = Number.parseInt(m[3], 10);
  if (!Number.isFinite(seq)) {
    return null;
  }
  return { stream, date, seq, fullPath: join(logDir, name) };
}

export interface LayeredRuntimeOptions {
  runtimeState: LoggingRuntimeState;
}

export class LayeredRuntime {
  private readonly runtimeState: LoggingRuntimeState;

  private readonly logDir: string;

  private readonly router: LogRouter;

  private readonly writer: LogWriter;

  private readonly budget: BudgetGate;

  private readonly retention: RetentionSweeper;

  private readonly pid = process.pid;
  private readonly host = hostname();
  private seq = 0;
  private startupTailRepairCount = 0;
  private firstAppendAfterRepairMarked = false;
  private readonly startupTs = Date.now();
  private firstWriteTs: number | null = null;

  constructor(options: LayeredRuntimeOptions) {
    this.runtimeState = options.runtimeState;
    this.logDir = env('LOG_DIR') ?? join(process.env.HOME ?? '/tmp', '.claw-insights', 'logs');

    this.router = new LogRouter({
      criticalQueueMax: safeInt(env('CRITICAL_QUEUE_MAX'), 10_000),
      criticalQueueMaxBytes: 16 * 1024 * 1024,
      bestEffortQueueMax: safeInt(env('BEST_EFFORT_QUEUE_MAX'), 50_000),
      bestEffortQueueMaxBytes: 32 * 1024 * 1024,
    });

    this.writer = new LogWriter({
      logDir: this.logDir,
      criticalFsyncMs: safeInt(env('CRITICAL_FSYNC_MS'), 100),
      criticalSyncBatch: safeInt(env('CRITICAL_SYNC_BATCH'), 1000),
      fileMode: safeInt(env('LOG_FILE_MODE'), 0o644),
      rotationSizeMb: { app: 64, error: 32, debug: 64, noise: 64, security: 32, access: 64 },
    });
    this.writer.start();

    const debugSoftMb = safeInt(env('DEBUG_SOFT_MB'), 200);
    this.budget = new BudgetGate({
      globalCapMb: safeInt(env('LOG_BUDGET_MB'), 1024),
      errorFloorMb: safeInt(env('ERROR_FLOOR_MB'), 300),
      errorReserveMb: safeInt(env('ERROR_RESERVE_MB'), 50),
      appSoftMb: safeInt(env('APP_SOFT_MB'), 500),
      debugSoftMb,
      noiseSoftMb: safeInt(env('NOISE_SOFT_MB'), debugSoftMb),
      accessSoftMb: safeInt(env('ACCESS_SOFT_MB'), 300),
    });
    this.budget.setReclaimFn((stream) => this.reclaimOldest(stream));

    this.retention = new RetentionSweeper({
      logDir: this.logDir,
      retentionDays: safeInt(env('LOG_RETENTION_DAYS'), 14),
      sweepIntervalMs: safeInt(env('LOG_SWEEP_INTERVAL_MS'), 600_000),
      graceHours: 1,
    });
    this.retention.start();

    // Startup tail repair
    this.startupTailRepairCount = this.repairActiveSegmentTails();

    process.once('beforeExit', () => {
      void this.shutdown();
    });
  }

  private repairActiveSegmentTails(): number {
    let repaired = 0;
    const today = new Date().toISOString().slice(0, 10);
    const streams: Array<'app' | 'error' | 'debug' | 'noise' | 'security' | 'access'> = [
      'app',
      'error',
      'debug',
      'noise',
      'security',
      'access',
    ];

    for (const stream of streams) {
      try {
        const files = readdirSync(this.logDir)
          .filter((f) => f.startsWith(`${stream}.${today}.`) && f.endsWith('.log'))
          .sort()
          .reverse();

        const latest = files[0];
        if (!latest) {
          continue;
        }

        const filePath = `${this.logDir}/${latest}`;
        const content = readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        let validEnd = 0;
        let pos = 0;
        for (const line of lines) {
          const lineBytes = Buffer.byteLength(line, 'utf-8');
          if (line.trim() === '') {
            pos += lineBytes + 1;
            validEnd = pos;
            continue;
          }
          try {
            JSON.parse(line);
            pos += lineBytes + 1;
            validEnd = pos;
          } catch {
            break;
          }
        }

        if (validEnd < Buffer.byteLength(content, 'utf-8')) {
          writeFileSync(filePath, content.slice(0, validEnd));
          repaired++;
        }
      } catch {
        // Directory or file not found - skip
      }
    }

    return repaired;
  }

  async shutdown(): Promise<void> {
    this.retention.stop();
    await this.writer.shutdown();
  }

  write(level: MethodLevel, module: string, args: unknown[]): void {
    const normalizedLevel = levelToLayeredLevel(level);
    const input = normalizeLogInput(args);

    const pressureState = this.runtimeState.snapshot().pressureState;
    if (normalizedLevel === 'debug' && pressureState !== 'normal') {
      this.runtimeState.incrementDropped('debug');
      return;
    }
    if (normalizedLevel === 'info') {
      const sampleRate = pressureState === 'emergency' ? 0.1 : pressureState === 'pressure' ? 0.5 : 1;
      if (!deterministicSampleDecision({ module, msgTemplate: input.msg, sampleRate, timestampMs: Date.now() })) {
        this.runtimeState.incrementDropped('info');
        return;
      }
    }

    const route = this.router.route({
      level: normalizedLevel,
      module,
      message: input.msg,
      timestamp: Date.now(),
      byteSize: 0,
    });

    const record = {
      ts: new Date().toISOString(),
      seq: ++this.seq,
      pid: this.pid,
      hostname: this.host,
      level: normalizedLevel,
      module,
      msg: input.msg,
      stream: route.stream,
      ...input.meta,
    };

    const serialized = JSON.stringify(record);
    const bytes = Buffer.byteLength(serialized + '\n', 'utf-8');

    if (!route.accepted) {
      if (route.lane === 'bestEffort') {
        // Best-effort overflow policy: drop debug first; sample info deterministically.
        if (normalizedLevel === 'debug') {
          this.runtimeState.incrementDropped('debug');
          this.updateRuntimeSignals();
          return;
        }

        if (
          normalizedLevel !== 'info' ||
          !deterministicSampleDecision({ module, msgTemplate: input.msg, sampleRate: 0.5, timestampMs: Date.now() })
        ) {
          this.runtimeState.incrementDropped('info');
          this.updateRuntimeSignals();
          return;
        }

        // sampled-in info bypasses queue admission and goes direct append path
        this.writeDirect(route.stream, route.lane, normalizedLevel, serialized, bytes);
        this.updateRuntimeSignals();
        return;
      }
      // critical lane queue-full fallback: sync append path (no silent drop)
      this.writeDirect(route.stream, route.lane, normalizedLevel, serialized, bytes);
      this.updateRuntimeSignals();
      return;
    }

    this.writeDirect(route.stream, route.lane, normalizedLevel, serialized, bytes);
    this.router.drain(route.lane, 1, bytes);
    this.updateRuntimeSignals();
  }

  private writeDirect(
    stream: LogStream,
    lane: LogLane,
    level: 'debug' | 'info' | 'warn' | 'error',
    data: string,
    bytes: number,
  ): void {
    this.retention.setActiveFiles(this.writer.getActiveFilePaths());

    if (!this.budget.checkAppend(stream, bytes)) {
      if (level === 'warn' || level === 'error') {
        this.runtimeState.incrementDropped('error');
      } else {
        this.runtimeState.incrementDropped(level === 'debug' ? 'debug' : 'info');
      }
      return;
    }

    const wrote = this.writer.append(stream, lane, data);
    this.budget.recordAppend(stream, wrote);
    this.runtimeState.incrementAccepted();

    if (wrote > 0) {
      this.markFirstSuccessfulAppend();
    }
  }

  private markFirstSuccessfulAppend(): void {
    if (this.firstWriteTs === null) {
      this.firstWriteTs = Date.now();
    }

    if (this.startupTailRepairCount > 0 && !this.firstAppendAfterRepairMarked) {
      this.firstAppendAfterRepairMarked = true;
    }
  }

  private updateRuntimeSignals(): void {
    const critical = this.router.stats('critical');
    const bestEffort = this.router.stats('bestEffort');
    const budget = this.budget.state();

    this.runtimeState.updateQueue({
      criticalDepth: critical.depth,
      criticalCapacity: critical.capacity,
      bestEffortDepth: bestEffort.depth,
      bestEffortCapacity: bestEffort.capacity,
    });

    const capBytes = safeInt(env('LOG_BUDGET_MB'), 1024) * 1024 * 1024;
    this.runtimeState.updateSignals({
      budgetUsagePct: capBytes === 0 ? 0 : (budget.totalUsed / capBytes) * 100,
      freeSpaceMb: budget.freeSpaceMb,
      tailRepairCount: this.startupTailRepairCount,
      firstAppendAfterRepair: this.firstAppendAfterRepairMarked,
      recoveredWithinDurabilityWindowMs: this.firstWriteTs !== null ? this.firstWriteTs - this.startupTs : 0,
    });
    this.runtimeState.evaluatePressure();
  }

  private reclaimOldest(stream: LogStream): { stream: LogStream; path: string; sizeBytes: number } | null {
    const active = this.writer.getActiveFilePaths();
    const candidates = readdirSync(this.logDir)
      .map((name) => parseSegment(this.logDir, name))
      .filter((v): v is ParsedSegment => v !== null)
      .filter((v) => v.stream === stream)
      .filter((v) => !active.has(v.fullPath))
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        return a.seq - b.seq;
      });

    const oldest = candidates[0];
    if (!oldest) {
      return null;
    }

    const sizeBytes = statSync(oldest.fullPath).size;
    unlinkSync(oldest.fullPath);
    return { stream, path: oldest.fullPath, sizeBytes };
  }
}
