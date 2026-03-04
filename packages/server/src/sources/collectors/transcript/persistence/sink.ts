import { insertMessageEventBatch } from '../../../../db/message-queries.js';
import { type ScanStateRow,upsertScanState } from '../../../../db/scan-state-queries.js';
import { insertTokenUsageEventBatch } from '../../../../db/token-queries.js';
import { createChildLogger } from '../../../../logger.js';
import type { FileResult, FlushPolicy, SinkDeps, TranscriptSink } from '../types.js';

const log = createChildLogger('transcript-sink');

export const BATCH_FLUSH: FlushPolicy = { maxEvents: 5000, maxLatencyMs: 10000 };
export const WATCH_FLUSH: FlushPolicy = { maxEvents: 200, maxLatencyMs: 2000 };

export function createTranscriptSink(deps: SinkDeps, policy: FlushPolicy): TranscriptSink {
  const immutablePolicy: FlushPolicy = Object.freeze({
    maxEvents: policy.maxEvents,
    maxLatencyMs: policy.maxLatencyMs,
  });

  let tokenBuffer: FileResult['tokens'] = [];
  let messageBuffer: FileResult['messages'] = [];
  let stateBuffer: FileResult[] = [];
  let flushTimer: NodeJS.Timeout | null = null;
  let destroyed = false;

  const clearFlushTimer = (): void => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
  };

  const scheduleFlush = (): void => {
    if (flushTimer) {
      return;
    }
    flushTimer = setTimeout(() => {
      void flush().catch((err) => {
        log.error({ err }, 'scheduled flush failed');
      });
    }, immutablePolicy.maxLatencyMs);
  };

  const bufferedEventCount = (): number => tokenBuffer.length + messageBuffer.length;
  const hasBufferedData = (): boolean =>
    tokenBuffer.length > 0 || messageBuffer.length > 0 || stateBuffer.length > 0;

  const accept = (result: FileResult): void => {
    if (destroyed) {
      throw new Error('transcript sink is destroyed');
    }

    for (const token of result.tokens) {
      deps.tokenBus?.emit(token);
    }
    for (const message of result.messages) {
      deps.messageBus?.emit(message);
    }

    tokenBuffer.push(...result.tokens);
    messageBuffer.push(...result.messages);
    stateBuffer.push(result);

    if (bufferedEventCount() >= immutablePolicy.maxEvents) {
      void flush().catch((err) => {
        log.error({ err }, 'threshold flush failed');
      });
      return;
    }

    scheduleFlush();
  };

  const flush = async (): Promise<void> => {
    clearFlushTimer();

    if (!hasBufferedData()) {
      return;
    }

    // Clear buffers before transaction to prevent retry growth on failure.
    const flushedTokens = tokenBuffer;
    const flushedMessages = messageBuffer;
    const flushedResults = stateBuffer;
    tokenBuffer = [];
    messageBuffer = [];
    stateBuffer = [];

    const scanRows = flushedResults.map(toScanStateRow);

    try {
      deps.db.transaction((tx) => {
        insertTokenUsageEventBatch(tx, flushedTokens);
        insertMessageEventBatch(tx, flushedMessages);
        upsertScanState(tx, scanRows);
      });
    } catch (err) {
      log.error({ err }, 'failed to flush transcript buffers');
      throw err;
    }

    if (flushedMessages.length > 0 && deps.onFlush) {
      await deps.onFlush(flushedMessages.length);
    }
  };

  const destroy = async (): Promise<void> => {
    if (destroyed) {
      return;
    }

    try {
      await flush();
    } finally {
      clearFlushTimer();
      destroyed = true;
    }
  };

  return {
    accept,
    flush,
    destroy,
  };
}

export function toScanStateRow(result: FileResult): ScanStateRow {
  return {
    filePath: result.task.path,
    byteOffset: result.newState.offset,
    inode: result.newState.inode,
    mtimeMs: result.newState.mtimeMs,
    birthMs: result.newState.birthtimeMs,
    partial: result.newState.partial,
    firstTimestampMs: result.newState.firstTimestampMs,
  };
}
