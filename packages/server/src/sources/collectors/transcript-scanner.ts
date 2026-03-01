import { existsSync } from 'node:fs';
import { cpus } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

import type { ScanStateRow } from '../../db/scan-state-queries.js';
import type { FileToScan } from './file-classifier.js';
import type { ScanWorkerResult, ScanWorkerTask } from './scan-worker.js';
import { streamScanFile } from './stream-scanner.js';
import type { ParsedMessageEvent, ParsedTokenEvent } from './transcript-parser.js';

export interface ScanSink {
  onToken(event: ParsedTokenEvent): void;
  onMessage(event: ParsedMessageEvent): void;
  onFileComplete(state: ScanStateRow): void;
}

export interface ScanOpts {
  workerThreshold?: number;
  workerCount?: number;
  yieldBatchSize?: number;
  onError?: (file: string, err: Error) => void;
  fallbackToMainThread?: boolean;
  signal?: AbortSignal;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

export function workerCount(override?: number): number {
  if (override != null && override >= 1) {
    return override;
  }
  const envVal = parseInt(process.env.CLAW_INSIGHTS_SCAN_WORKERS ?? '', 10);
  if (Number.isFinite(envVal) && envVal >= 1) {
    return envVal;
  }
  return Math.min(Math.max(1, cpus().length - 1), 4);
}

export function resolveWorkerPath(): string {
  const thisDir = dirname(fileURLToPath(import.meta.url));
  const tsPath = join(thisDir, 'scan-worker.ts');
  if (existsSync(tsPath)) {
    return tsPath;
  }
  const jsPath = join(thisDir, 'scan-worker.js');
  if (existsSync(jsPath)) {
    return jsPath;
  }
  return new URL('../../../dist/scan-worker.js', import.meta.url).pathname;
}

async function scanOnMainThread(toScan: FileToScan[], sink: ScanSink, opts: ScanOpts): Promise<void> {
  const batchSize = opts.yieldBatchSize ?? 30;

  for (let i = 0; i < toScan.length; i++) {
    if (opts.signal?.aborted) {
      return;
    }
    const task = toScan[i];
    try {
      const result = await streamScanFile(
        task.path,
        task.offset,
        task.partial,
        (t) => sink.onToken(t),
        (m) => sink.onMessage(m),
      );
      sink.onFileComplete({
        filePath: task.path,
        byteOffset: result.newOffset,
        inode: result.inode,
        mtimeMs: result.mtimeMs,
        birthMs: result.birthtimeMs,
        partial: result.partial,
        firstTimestampMs: result.firstTimestampMs ?? task.prevFirstTimestampMs,
      });
    } catch (err) {
      if (opts.onError) {
        opts.onError(task.path, err instanceof Error ? err : new Error(String(err)));
      }
    }

    if ((i + 1) % batchSize === 0) {
      await yieldToEventLoop();
      if (opts.signal?.aborted) {
        return;
      }
    }
  }
}

function runWorker(workerPath: string, task: ScanWorkerTask): Promise<ScanWorkerResult> {
  return new Promise((resolve, reject) => {
    const w = new Worker(workerPath, { workerData: task });
    w.on('message', (msg: ScanWorkerResult) => resolve(msg));
    w.on('error', reject);
    w.on('exit', (code) => {
      if (code !== 0) {
        reject(new Error(`Worker exited with code ${code}`));
      }
    });
  });
}

async function scanWithWorkers(toScan: FileToScan[], sink: ScanSink, opts: ScanOpts): Promise<void> {
  const numWorkers = workerCount(opts.workerCount);
  const chunkSize = Math.ceil(toScan.length / numWorkers);
  const workerPath = resolveWorkerPath();

  const chunks: FileToScan[][] = [];
  for (let i = 0; i < toScan.length; i += chunkSize) {
    chunks.push(toScan.slice(i, i + chunkSize));
  }

  // Launch workers sequentially to limit memory
  for (const chunk of chunks) {
    if (opts.signal?.aborted) {
      return;
    }
    const task: ScanWorkerTask = {
      files: chunk.map((f) => ({ path: f.path, offset: f.offset, partial: f.partial })),
    };

    let result: ScanWorkerResult;
    try {
      result = await runWorker(workerPath, task);
    } catch {
      // Worker spawn failed — fall back to main thread if allowed
      if (opts.fallbackToMainThread !== false) {
        await scanOnMainThread(chunk, sink, opts);
        continue;
      }
      throw new Error('Worker failed and fallback disabled');
    }

    // Feed events through sink
    for (const t of result.tokenEvents) {
      sink.onToken(t);
    }
    for (const m of result.messageEvents) {
      sink.onMessage(m);
    }

    // Feed file completions
    for (let fi = 0; fi < result.files.length; fi++) {
      const fr = result.files[fi];
      const originalTask = chunk[fi];

      if (fr.error) {
        if (opts.onError) {
          opts.onError(fr.path, new Error(fr.error));
        }
        continue;
      }

      sink.onFileComplete({
        filePath: fr.path,
        byteOffset: fr.scan.newOffset,
        inode: fr.scan.inode,
        mtimeMs: fr.scan.mtimeMs,
        birthMs: fr.scan.birthtimeMs,
        partial: fr.scan.partial,
        firstTimestampMs: fr.scan.firstTimestampMs ?? originalTask.prevFirstTimestampMs,
      });
    }
  }
}

export async function scanFiles(toScan: FileToScan[], sink: ScanSink, opts?: ScanOpts): Promise<void> {
  if (toScan.length === 0) {
    return;
  }

  const resolvedOpts: ScanOpts = { ...opts };
  const threshold = resolvedOpts.workerThreshold ?? 10;

  if (toScan.length > threshold) {
    await scanWithWorkers(toScan, sink, resolvedOpts);
  } else {
    await scanOnMainThread(toScan, sink, resolvedOpts);
  }
}
