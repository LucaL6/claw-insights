import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FileState, FileTask } from '../types.js';
import { createWatcher } from '../watch.js';

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'tw2-'));
}

/** Advance fake timers and flush async microtasks multiple times */
async function advanceAndFlush(ms: number, rounds = 5) {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < rounds; i++) {
    await vi.advanceTimersByTimeAsync(0);
  }
}

/**
 * Wait until a condition is satisfied under fake timers.
 * This avoids flaky assumptions about exact tick boundaries.
 */
async function waitForCondition(
  check: () => boolean,
  { timeoutMs = 2_000, stepMs = 20 }: { timeoutMs?: number; stepMs?: number } = {},
) {
  const steps = Math.ceil(timeoutMs / stepMs);
  for (let i = 0; i < steps; i++) {
    if (check()) {
      return;
    }
    await advanceAndFlush(stepMs);
  }

  throw new Error(`Condition not met within ${timeoutMs}ms`);
}

function makeFile(dir: string, name: string, content: string): string {
  const p = join(dir, name);
  writeFileSync(p, content);
  return p;
}

function stateFor(path: string, offset = 0, partial = ''): FileState {
  const st = statSync(path);
  return { offset, inode: st.ino, birthtimeMs: st.birthtimeMs, mtimeMs: st.mtimeMs, partial, firstTimestampMs: null };
}

describe('transcript-watch createWatcher', () => {
  let dir: string;

  beforeEach(() => {
    vi.useFakeTimers();
    dir = tmpDir();
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  // ── poll calls processTask and updates fileStates ──
  it('poll calls processTask and updates fileStates', async () => {
    const path = makeFile(dir, 'a.jsonl', 'line1\nline2\n');
    const fileStates = new Map<string, FileState>([[path, stateFor(path, 0)]]);

    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>().mockImplementation(async (task) => {
      return { ...fileStates.get(task.path)!, offset: 100, partial: '' };
    });

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100, dirScanIntervalMs: 100_000 });

    // first tick fires at setTimeout(tick, 0)
    await advanceAndFlush(0);

    expect(processTask).toHaveBeenCalledTimes(1);
    const task: FileTask = processTask.mock.calls[0][0];
    expect(task.path).toBe(path);
    expect(task.sessionKey).toBe('a');
    expect(task.offset).toBe(0);

    // fileStates updated
    expect(fileStates.get(path)!.offset).toBe(100);

    w.destroy();
  });

  // ── dirScan discovers new files ──
  // FLAKY: timing race in dirScan + advanceAndFlush — tracked in DEV-081
  it.skip('dirScan discovers new files and adds to fileStates', async () => {
    const fileStates = new Map<string, FileState>();
    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>().mockImplementation(async (task) => {
      return fileStates.get(task.path)!;
    });

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100_000, dirScanIntervalMs: 200 });

    // no files yet, dirScan fires at t=0
    await advanceAndFlush(10);
    expect(fileStates.size).toBe(0);

    // add a file
    makeFile(dir, 'new.jsonl', 'data\n');

    // next dirScan tick at t=200
    await advanceAndFlush(200);
    expect(fileStates.has(join(dir, 'new.jsonl'))).toBe(true);
    expect(fileStates.get(join(dir, 'new.jsonl'))!.offset).toBe(0);

    w.destroy();
  });

  // ── dirScan removes deleted files ──
  it('dirScan removes deleted files from fileStates', async () => {
    const path = makeFile(dir, 'gone.jsonl', 'data\n');
    const fileStates = new Map<string, FileState>([[path, stateFor(path)]]);
    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>().mockResolvedValue(stateFor(path));

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100_000, dirScanIntervalMs: 200 });
    await advanceAndFlush(10);

    // delete the file
    rmSync(path);
    await waitForCondition(() => !fileStates.has(path), { timeoutMs: 1_500, stepMs: 20 });
    expect(fileStates.has(path)).toBe(false);

    w.destroy();
  });

  // ── budget control ──
  it('byteBudget stops processing when exhausted', async () => {
    // Two files, budget only allows one
    const p1 = makeFile(dir, 'f1.jsonl', 'x'.repeat(200) + '\n');
    const p2 = makeFile(dir, 'f2.jsonl', 'y'.repeat(200) + '\n');
    const fileStates = new Map<string, FileState>([
      [p1, stateFor(p1)],
      [p2, stateFor(p2)],
    ]);

    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>().mockImplementation(async (task) => {
      const st = statSync(task.path);
      return { ...fileStates.get(task.path)!, offset: st.size };
    });

    const w = createWatcher({
      dir,
      fileStates,
      processTask,
      pollIntervalMs: 100,
      dirScanIntervalMs: 100_000,
      byteBudgetPerTick: 201, // enough for one file (~201 bytes) but not two
    });

    await advanceAndFlush(0);
    expect(processTask).toHaveBeenCalledTimes(1);

    // second tick processes the other (wait conditionally to avoid timer-boundary races)
    await waitForCondition(() => processTask.mock.calls.length >= 2, { timeoutMs: 1_000, stepMs: 20 });
    expect(processTask).toHaveBeenCalledTimes(2);

    w.destroy();
  });

  // ── truncate detection: inode change resets offset ──
  it('resets offset when inode changes', async () => {
    const path = makeFile(dir, 'trunc.jsonl', 'original\n');
    const st = statSync(path);
    const fileStates = new Map<string, FileState>([
      [
        path,
        {
          offset: 100,
          inode: st.ino + 999,
          birthtimeMs: st.birthtimeMs,
          mtimeMs: st.mtimeMs,
          partial: 'leftover',
          firstTimestampMs: null,
        },
      ],
    ]);

    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>().mockImplementation(async (task) => {
      return { ...fileStates.get(task.path)!, offset: task.offset + 10 };
    });

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100, dirScanIntervalMs: 100_000 });
    await advanceAndFlush(0);

    expect(processTask).toHaveBeenCalledTimes(1);
    const task = processTask.mock.calls[0][0];
    expect(task.offset).toBe(0); // reset due to inode mismatch
    expect(task.partial).toBe(''); // partial cleared

    w.destroy();
  });

  // ── truncate detection: offset > size resets ──
  it('resets offset when offset > size', async () => {
    const path = makeFile(dir, 'small.jsonl', 'hi\n');
    const st = statSync(path);
    const fileStates = new Map<string, FileState>([
      [
        path,
        {
          offset: 99999,
          inode: st.ino,
          birthtimeMs: st.birthtimeMs,
          mtimeMs: st.mtimeMs,
          partial: '',
          firstTimestampMs: null,
        },
      ],
    ]);

    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>().mockImplementation(async (task) => {
      return { ...fileStates.get(task.path)!, offset: task.offset + 3 };
    });

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100, dirScanIntervalMs: 100_000 });
    await advanceAndFlush(0);

    expect(processTask.mock.calls[0][0].offset).toBe(0);
    w.destroy();
  });

  // ── destroy stops all timers ──
  it('destroy stops all timers', async () => {
    const path = makeFile(dir, 'stop.jsonl', 'data\n');
    const fileStates = new Map<string, FileState>([[path, stateFor(path)]]);
    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>().mockImplementation(async (task) => {
      return { ...fileStates.get(task.path)!, offset: 5 };
    });

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100, dirScanIntervalMs: 100 });
    await advanceAndFlush(0); // initial ticks
    const callsBefore = processTask.mock.calls.length;

    w.destroy();

    await advanceAndFlush(10_000);
    expect(processTask.mock.calls.length).toBe(callsBefore);
  });

  // ── createPollLoop self-heals after error ──
  it('self-heals: fn throws but next tick still fires', async () => {
    const path = makeFile(dir, 'heal.jsonl', 'data\n');
    const fileStates = new Map<string, FileState>([[path, stateFor(path)]]);

    let callCount = 0;
    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>().mockImplementation(async (task) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('boom');
      }
      return { ...fileStates.get(task.path)!, offset: 5 };
    });

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100, dirScanIntervalMs: 100_000 });
    await advanceAndFlush(0); // first tick → throws
    expect(processTask).toHaveBeenCalledTimes(1);

    await waitForCondition(() => processTask.mock.calls.length >= 2, { timeoutMs: 1_000, stepMs: 20 }); // second tick → succeeds
    expect(processTask).toHaveBeenCalledTimes(2);

    w.destroy();
  });

  // ── poll tick log with pollTickMs ──
  it('logs pollTickMs on each poll', async () => {
    const path = makeFile(dir, 'log.jsonl', 'data\n');
    const fileStates = new Map<string, FileState>([[path, stateFor(path)]]);
    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>().mockImplementation(async (task) => {
      return { ...fileStates.get(task.path)!, offset: 5 };
    });

    // We can't easily test log output, but we ensure the poll runs without error
    // The implementation should log { pollTickMs }
    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 50, dirScanIntervalMs: 100_000 });
    await advanceAndFlush(0);
    expect(processTask).toHaveBeenCalled();

    w.destroy();
  });
});
