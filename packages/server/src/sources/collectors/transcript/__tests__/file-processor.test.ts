import { describe, expect, it, vi } from 'vitest';

import { createFileProcessor } from '../processing/file-processor.js';
import type { FileResult, FileTask, TranscriptSink } from '../types.js';

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

function makeResult(task: FileTask, overrides: Partial<FileResult> = {}): FileResult {
  return {
    task,
    tokens: [],
    messages: [],
    firstTimestampMs: null,
    newState: {
      offset: task.offset,
      inode: task.inode ?? 10,
      birthtimeMs: task.birthtimeMs ?? 100,
      mtimeMs: 200,
      partial: task.partial,
      firstTimestampMs: task.prevFirstTimestampMs,
    },
    ...overrides,
  };
}

describe('file-processor', () => {
  it('chunkBytes=Infinity calls process once and sink.accept once', async () => {
    const task = makeTask();
    const result = makeResult(task, {
      newState: {
        offset: 12,
        inode: 88,
        birthtimeMs: 99,
        mtimeMs: 123,
        partial: 'tail',
        firstTimestampMs: null,
      },
    });

    const process = vi.fn(async () => result);
    const sink: TranscriptSink = {
      accept: vi.fn(),
      flush: vi.fn(),
      destroy: vi.fn(),
    };

    const run = createFileProcessor({ process, sink, chunkBytes: Number.POSITIVE_INFINITY });
    const state = await run(task);

    expect(process).toHaveBeenCalledTimes(1);
    expect(process).toHaveBeenCalledWith(task);
    expect(sink.accept).toHaveBeenCalledTimes(1);
    expect(sink.accept).toHaveBeenCalledWith(result);
    expect(state).toEqual(result.newState);
  });

  it('chunkBytes small triggers multiple process and sink.accept calls', async () => {
    const task = makeTask();
    const r1 = makeResult(task, {
      newState: {
        offset: 5,
        inode: 11,
        birthtimeMs: 22,
        mtimeMs: 1,
        partial: 'pa',
        firstTimestampMs: null,
      },
    });
    const r2Task = makeTask({ offset: 5, partial: 'pa', inode: 11, birthtimeMs: 22 });
    const r2 = makeResult(r2Task, {
      newState: {
        offset: 9,
        inode: 11,
        birthtimeMs: 22,
        mtimeMs: 2,
        partial: 'part',
        firstTimestampMs: null,
      },
    });
    const r3Task = makeTask({ offset: 9, partial: 'part', inode: 11, birthtimeMs: 22 });
    const r3 = makeResult(r3Task, {
      newState: {
        offset: 9,
        inode: 11,
        birthtimeMs: 22,
        mtimeMs: 3,
        partial: 'final',
        firstTimestampMs: null,
      },
    });

    const process = vi.fn()
      .mockResolvedValueOnce(r1)
      .mockResolvedValueOnce(r2)
      .mockResolvedValueOnce(r3);

    const sink: TranscriptSink = {
      accept: vi.fn(),
      flush: vi.fn(),
      destroy: vi.fn(),
    };

    const run = createFileProcessor({ process, sink, chunkBytes: 4 });
    const state = await run(task);

    expect(process).toHaveBeenCalledTimes(3);
    expect(sink.accept).toHaveBeenCalledTimes(3);
    expect(state).toEqual(r3.newState);
  });

  it('EOF detection stops when offset does not advance', async () => {
    const task = makeTask({ offset: 10 });
    const r1 = makeResult(task, {
      newState: {
        offset: 10,
        inode: 7,
        birthtimeMs: 8,
        mtimeMs: 9,
        partial: 'unchanged',
        firstTimestampMs: null,
      },
    });

    const process = vi.fn().mockResolvedValue(r1);
    const sink: TranscriptSink = {
      accept: vi.fn(),
      flush: vi.fn(),
      destroy: vi.fn(),
    };

    const run = createFileProcessor({ process, sink, chunkBytes: 16 });
    await run(task);

    expect(process).toHaveBeenCalledTimes(1);
    expect(sink.accept).toHaveBeenCalledTimes(1);
  });

  it('propagates partial across chunks', async () => {
    const task = makeTask({ partial: 'a' });
    const r1 = makeResult(task, {
      newState: {
        offset: 3,
        inode: 1,
        birthtimeMs: 2,
        mtimeMs: 3,
        partial: 'ab',
        firstTimestampMs: null,
      },
    });
    const r2 = makeResult(makeTask({ offset: 3, partial: 'ab', inode: 1, birthtimeMs: 2 }), {
      newState: {
        offset: 3,
        inode: 1,
        birthtimeMs: 2,
        mtimeMs: 4,
        partial: 'ab',
        firstTimestampMs: null,
      },
    });

    const process = vi.fn()
      .mockResolvedValueOnce(r1)
      .mockResolvedValueOnce(r2);

    const sink: TranscriptSink = {
      accept: vi.fn(),
      flush: vi.fn(),
      destroy: vi.fn(),
    };

    const run = createFileProcessor({ process, sink, chunkBytes: 2 });
    await run(task);

    expect(process).toHaveBeenNthCalledWith(1, task, { maxBytes: 2 });
    expect(process).toHaveBeenNthCalledWith(2, expect.objectContaining({ partial: 'ab', offset: 3 }), { maxBytes: 2 });
  });

  it('propagates inode and birthtimeMs across chunks', async () => {
    const task = makeTask();
    const r1 = makeResult(task, {
      newState: {
        offset: 4,
        inode: 1234,
        birthtimeMs: 5678,
        mtimeMs: 20,
        partial: '',
        firstTimestampMs: null,
      },
    });
    const r2 = makeResult(makeTask({ offset: 4, inode: 1234, birthtimeMs: 5678 }), {
      newState: {
        offset: 4,
        inode: 1234,
        birthtimeMs: 5678,
        mtimeMs: 21,
        partial: '',
        firstTimestampMs: null,
      },
    });

    const process = vi.fn()
      .mockResolvedValueOnce(r1)
      .mockResolvedValueOnce(r2);

    const sink: TranscriptSink = {
      accept: vi.fn(),
      flush: vi.fn(),
      destroy: vi.fn(),
    };

    const run = createFileProcessor({ process, sink, chunkBytes: 2 });
    await run(task);

    expect(process).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ offset: 4, inode: 1234, birthtimeMs: 5678 }),
      { maxBytes: 2 },
    );
  });
});
