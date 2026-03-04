import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Database } from '../../../../db/database.js';
import { insertMessageEventBatch } from '../../../../db/message-queries.js';
import { upsertScanState } from '../../../../db/scan-state-queries.js';
import { insertTokenUsageEventBatch } from '../../../../db/token-queries.js';
import { MessageEventBus } from '../../../../events/message-event-bus.js';
import { TokenEventBus } from '../../../../events/token-event-bus.js';
import { createTranscriptSink } from '../persistence/sink.js';
import type { FileResult } from '../types.js';

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

  exec(): void {
    // no-op
  }

  close(): void {
    // no-op
  }

  transaction<T>(fn: (db: Database) => T): T {
    this.transactionCalls += 1;
    if (this.failNextTransaction) {
      this.failNextTransaction = false;
      throw new Error('forced tx failure');
    }
    return fn(this);
  }
}

function makeResult(overrides: Partial<FileResult> = {}): FileResult {
  return {
    task: {
      path: '/tmp/session-1.jsonl',
      offset: 0,
      partial: '',
      sessionKey: 'session-1',
      prevFirstTimestampMs: null,
    },
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
      partial: 'tail',
      firstTimestampMs: 999,
    },
    ...overrides,
  };
}

describe('transcript-sink', () => {
  const tokenBatchMock = vi.mocked(insertTokenUsageEventBatch);
  const messageBatchMock = vi.mocked(insertMessageEventBatch);
  const upsertScanStateMock = vi.mocked(upsertScanState);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('maxEvents triggers flush and writes DB rows', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 2, maxLatencyMs: 10_000 });

    sink.accept(makeResult());

    await vi.runAllTimersAsync();

    expect(db.transactionCalls).toBe(1);
    expect(tokenBatchMock).toHaveBeenCalledTimes(1);
    expect(messageBatchMock).toHaveBeenCalledTimes(1);
    expect(upsertScanStateMock).toHaveBeenCalledTimes(1);
  });

  it('flushes scan_state even when token/message buffers are empty', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 10_000 });

    sink.accept(makeResult({ tokens: [], messages: [] }));
    await sink.flush();

    expect(db.transactionCalls).toBe(1);
    expect(upsertScanStateMock).toHaveBeenCalledTimes(1);
  });

  it('maxLatencyMs triggers flush', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 2000 });

    sink.accept(makeResult());

    expect(db.transactionCalls).toBe(0);
    await vi.advanceTimersByTimeAsync(1999);
    expect(db.transactionCalls).toBe(0);

    await vi.advanceTimersByTimeAsync(1);
    expect(db.transactionCalls).toBe(1);
  });

  it('emits EventBus events immediately on accept', () => {
    const db = new MockDb();
    const tokenBus = new TokenEventBus();
    const messageBus = new MessageEventBus();

    const seenTokens: number[] = [];
    const seenMessages: number[] = [];
    tokenBus.on(() => seenTokens.push(Date.now()));
    messageBus.on(() => seenMessages.push(Date.now()));

    const sink = createTranscriptSink({ db, tokenBus, messageBus }, { maxEvents: 999, maxLatencyMs: 2000 });
    sink.accept(makeResult());

    expect(seenTokens).toHaveLength(1);
    expect(seenMessages).toHaveLength(1);
    expect(db.transactionCalls).toBe(0);
  });

  it('calls onFlush after DB flush with message count', async () => {
    const db = new MockDb();
    const onFlush = vi.fn();
    const sink = createTranscriptSink({ db, onFlush }, { maxEvents: 2, maxLatencyMs: 5000 });

    sink.accept(makeResult({ messages: [
      { timestamp: '2026-03-01T00:00:00Z', sessionKey: 'session-1', role: 'user', lineHash: 'a' },
      { timestamp: '2026-03-01T00:00:02Z', sessionKey: 'session-1', role: 'assistant', lineHash: 'b' },
    ] }));

    await vi.runAllTimersAsync();

    expect(onFlush).toHaveBeenCalledWith(2);
    expect(onFlush).toHaveBeenCalledTimes(1);
  });

  it('destroy triggers final flush', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 10_000 });

    sink.accept(makeResult());
    await sink.destroy();

    expect(db.transactionCalls).toBe(1);
  });

  it('accept after destroy throws', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 10_000 });

    await sink.destroy();

    expect(() => sink.accept(makeResult())).toThrow('transcript sink is destroyed');
  });

  it('transaction failure propagates', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 10_000 });

    sink.accept(makeResult());
    db.failNextTransaction = true;

    await expect(sink.flush()).rejects.toThrow('forced tx failure');
  });

  it('flush on empty buffer is no-op', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 10_000 });

    await sink.flush();

    expect(db.transactionCalls).toBe(0);
    expect(tokenBatchMock).not.toHaveBeenCalled();
    expect(messageBatchMock).not.toHaveBeenCalled();
    expect(upsertScanStateMock).not.toHaveBeenCalled();
  });

  it('C1: failed DB flush clears internal buffer (second flush no-ops)', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 999, maxLatencyMs: 10_000 });

    sink.accept(makeResult());
    db.failNextTransaction = true;

    await expect(sink.flush()).rejects.toThrow('forced tx failure');

    tokenBatchMock.mockClear();
    messageBatchMock.mockClear();
    upsertScanStateMock.mockClear();

    await sink.flush();

    expect(db.transactionCalls).toBe(1);
    expect(tokenBatchMock).not.toHaveBeenCalled();
    expect(messageBatchMock).not.toHaveBeenCalled();
    expect(upsertScanStateMock).not.toHaveBeenCalled();
  });

  it('C2: scan_state firstTimestampMs comes from newState.firstTimestampMs', async () => {
    const db = new MockDb();
    const sink = createTranscriptSink({ db }, { maxEvents: 2, maxLatencyMs: 10_000 });

    sink.accept(makeResult({
      firstTimestampMs: 111,
      newState: {
        offset: 100,
        inode: 200,
        birthtimeMs: 300,
        mtimeMs: 400,
        partial: '',
        firstTimestampMs: 999,
      },
    }));

    await vi.runAllTimersAsync();

    const rows = upsertScanStateMock.mock.calls[0]?.[1] as Array<{ firstTimestampMs: number | null }>;
    expect(rows).toHaveLength(1);
    expect(rows[0].firstTimestampMs).toBe(999);
  });
});
