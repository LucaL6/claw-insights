import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../../../../db/database.js';
import { insertMessageEventBatch } from '../../../../db/message-queries.js';
import { upsertScanState } from '../../../../db/scan-state-queries.js';
import { insertTokenUsageEventBatch } from '../../../../db/token-queries.js';
import { createTranscriptSink } from '../persistence/sink.js';
import { createFileProcessor } from '../processing/file-processor.js';
import type { FileResult, FileTask } from '../types.js';

vi.mock('../../../../db/token-queries.js', () => ({
  insertTokenUsageEventBatch: vi.fn(),
}));

vi.mock('../../../../db/message-queries.js', () => ({
  insertMessageEventBatch: vi.fn(),
}));

vi.mock('../../../../db/scan-state-queries.js', () => ({
  upsertScanState: vi.fn(),
}));

class MockDb implements Database {
  public transactionCalls = 0;
  public failNextTransaction = false;

  prepare(): never {
    throw new Error('not implemented');
  }

  exec(): void {}

  close(): void {}

  transaction<T>(fn: (db: Database) => T): T {
    this.transactionCalls += 1;
    if (this.failNextTransaction) {
      this.failNextTransaction = false;
      throw new Error('forced tx failure');
    }
    return fn(this);
  }
}

function makeTask(overrides: Partial<FileTask> = {}): FileTask {
  return {
    path: '/tmp/session-1.jsonl',
    offset: 0,
    partial: '',
    sessionKey: 'session-1',
    prevFirstTimestampMs: null,
    ...overrides,
  };
}

function makeResult(overrides: Partial<FileResult> = {}): FileResult {
  return {
    task: makeTask(),
    tokens: [{
      timestamp: '2026-03-01T00:00:01Z',
      sessionKey: 'session-1',
      model: 'claude-sonnet',
      inputTokens: 10,
      outputTokens: 20,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    }],
    messages: [{
      timestamp: '2026-03-01T00:00:00Z',
      sessionKey: 'session-1',
      role: 'user',
      lineHash: 'abc12345',
    }],
    firstTimestampMs: 111,
    newState: {
      offset: 123,
      inode: 7,
      birthtimeMs: 11,
      mtimeMs: 22,
      partial: '',
      firstTimestampMs: 999,
    },
    ...overrides,
  };
}

const tokenBatchMock = vi.mocked(insertTokenUsageEventBatch);
const messageBatchMock = vi.mocked(insertMessageEventBatch);
const upsertScanStateMock = vi.mocked(upsertScanState);

describe('crash recovery (Design §6)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('recovers from flush failure — offset not updated, rescan works', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 10_000 });

    sink.accept(makeResult());
    db.failNextTransaction = true;

    await expect(sink.flush()).rejects.toThrow('forced tx failure');
    // DB write failed — scan_state not updated
    expect(upsertScanStateMock).not.toHaveBeenCalled();

    // Simulate restart: new sink, rescan from old offset (0)
    const sink2 = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 10_000 });
    sink2.accept(makeResult());
    await sink2.flush();

    expect(tokenBatchMock).toHaveBeenCalledTimes(1);
    expect(messageBatchMock).toHaveBeenCalledTimes(1);
    expect(upsertScanStateMock).toHaveBeenCalledTimes(1);
  });

  it('idempotent rescan — duplicate events written via INSERT batch', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 10_000 });

    const mockProcess = vi.fn<(task: FileTask) => Promise<FileResult>>();
    mockProcess.mockResolvedValue(makeResult());

    const processTask = createFileProcessor({ process: mockProcess, sink });

    // First scan
    await processTask(makeTask());
    await sink.flush();
    expect(upsertScanStateMock).toHaveBeenCalledTimes(1);

    // Clear to count second pass
    tokenBatchMock.mockClear();
    messageBatchMock.mockClear();
    upsertScanStateMock.mockClear();

    // Rescan from offset 0 (simulating manual reset)
    mockProcess.mockResolvedValue(makeResult());
    await processTask(makeTask({ offset: 0 }));
    await sink.flush();

    // Second pass writes the same data (append-only or INSERT OR IGNORE)
    expect(tokenBatchMock).toHaveBeenCalledTimes(1);
    expect(messageBatchMock).toHaveBeenCalledTimes(1);
    expect(upsertScanStateMock).toHaveBeenCalledTimes(1);
  });
});

describe('race conditions (Design §15.3)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('file deleted between stat and read — processFile rejects, caller skips', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 10_000 });

    const mockProcess = vi.fn<(task: FileTask) => Promise<FileResult>>();
    mockProcess.mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const processTask = createFileProcessor({ process: mockProcess, sink });

    await expect(processTask(makeTask())).rejects.toThrow('ENOENT');

    // Sink received nothing — flush is no-op
    await sink.flush();
    expect(db.transactionCalls).toBe(0);
  });

  it('destroy during pending flush — final flush executes once', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 10_000 });

    sink.accept(makeResult());
    await sink.destroy();

    // destroy triggers final flush
    expect(db.transactionCalls).toBe(1);
    expect(tokenBatchMock).toHaveBeenCalledTimes(1);
  });

  it('sink destroy is idempotent — second destroy is no-op', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 10_000 });

    sink.accept(makeResult());
    await sink.destroy();
    await sink.destroy();

    // Only one flush from first destroy
    expect(db.transactionCalls).toBe(1);
  });

  it('accept after destroy throws immediately', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 10_000 });

    await sink.destroy();
    expect(() => sink.accept(makeResult())).toThrow('transcript sink is destroyed');
  });
});
