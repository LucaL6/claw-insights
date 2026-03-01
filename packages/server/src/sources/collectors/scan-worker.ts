import { parentPort, workerData } from 'node:worker_threads';

import { streamScanFile, type StreamScanResult } from './stream-scanner.js';
import type { ParsedMessageEvent, ParsedTokenEvent } from './transcript-parser.js';

export interface ScanWorkerFileTask {
  path: string;
  offset: number;
  partial: string;
}

export interface ScanWorkerTask {
  files: ScanWorkerFileTask[];
}

export interface ScanWorkerFileResult {
  path: string;
  scan: StreamScanResult;
  error?: string;
}

export interface ScanWorkerResult {
  files: ScanWorkerFileResult[];
  tokenEvents: ParsedTokenEvent[];
  messageEvents: ParsedMessageEvent[];
}

export async function run(task: ScanWorkerTask): Promise<ScanWorkerResult> {
  const tokenEvents: ParsedTokenEvent[] = [];
  const messageEvents: ParsedMessageEvent[] = [];
  const files: ScanWorkerFileResult[] = [];

  for (const fileTask of task.files) {
    try {
      const scan = await streamScanFile(
        fileTask.path,
        fileTask.offset,
        fileTask.partial,
        (t) => tokenEvents.push(t),
        (m) => messageEvents.push(m),
      );
      files.push({ path: fileTask.path, scan });
    } catch (err) {
      files.push({
        path: fileTask.path,
        scan: { newOffset: 0, partial: '', birthtimeMs: 0, inode: 0, mtimeMs: 0, firstTimestampMs: null },
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { files, tokenEvents, messageEvents };
}

// Only execute when running as a worker thread
if (parentPort) {
  const port = parentPort;
  const task = workerData as ScanWorkerTask;
  run(task)
    .then((result) => port.postMessage(result))
    .catch((err) => {
      port.postMessage({
        files: [],
        tokenEvents: [],
        messageEvents: [],
        error: err instanceof Error ? err.message : String(err),
      });
    });
}
