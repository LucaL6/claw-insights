import type { Database } from '../../../db/database.js';
import type { MessageEventBus } from '../../../events/message-event-bus.js';
import type { TokenEventBus } from '../../../events/token-event-bus.js';
import type { ParsedMessageEvent, ParsedTokenEvent } from './processing/parser.js';

/** Describes a file to be processed by the pipeline */
export interface FileTask {
  path: string;
  offset: number;
  partial: string;
  sessionKey: string;
  prevFirstTimestampMs: number | null;
  /** Previous inode — used for truncate/rotate detection. Undefined for new files. */
  inode?: number;
  /** Previous birthtimeMs — undefined for new files. */
  birthtimeMs?: number;
}

/** Represents persisted state of a scanned file (aligned with ScanStateRow) */
export interface FileState {
  offset: number;
  inode: number;
  birthtimeMs: number;
  mtimeMs: number;
  partial: string;
  firstTimestampMs: number | null;
}

/** Output of processFile — one result per file */
export interface FileResult {
  task: FileTask;
  tokens: ParsedTokenEvent[];
  messages: ParsedMessageEvent[];
  newState: FileState;
  firstTimestampMs: number | null;
}

/** Controls when the sink flushes buffered events */
export interface FlushPolicy {
  /** Flush when buffer reaches this many events (like Kafka batch.size) */
  maxEvents: number;
  /** Flush after this many ms since first buffered event (like Kafka linger.ms) */
  maxLatencyMs: number;
}

export type OnFlushHook = (flushedMessages: number) => void | Promise<void>;

/** Accepts pipeline results, buffers, and flushes to DB + EventBus */
export interface TranscriptSink {
  accept(result: FileResult): void;
  flush(): void | Promise<void>;
  destroy(): void | Promise<void>;
}

export interface SinkDeps {
  db: Database;
  tokenBus?: TokenEventBus;
  messageBus?: MessageEventBus;
  onFlush?: OnFlushHook;
}
