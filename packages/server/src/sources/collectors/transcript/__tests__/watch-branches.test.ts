/**
 * Additional branch-coverage tests for watch.ts
 * Targets uncovered lines 17-119, 152, 162-174
 */
import { mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { FileState, FileTask } from '../types.js';
import { createWatcher } from '../watch.js';

function tmpDir() {
  return mkdtempSync(join(tmpdir(), 'tw3-'));
}

async function advanceAndFlush(ms: number, rounds = 5) {
  await vi.advanceTimersByTimeAsync(ms);
  for (let i = 0; i < rounds; i++) {
    await vi.advanceTimersByTimeAsync(0);
  }
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

describe('watch.ts branch coverage', () => {
  let dir: string;

  beforeEach(() => {
    vi.useFakeTimers();
    dir = tmpDir();
  });

  afterEach(() => {
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  // ── poll with empty fileStates → "no files" branch ──
  it('poll with empty fileStates logs and returns early', async () => {
    const fileStates = new Map<string, FileState>();
    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>();

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100, dirScanIntervalMs: 100_000 });
    await advanceAndFlush(0);

    expect(processTask).not.toHaveBeenCalled();
    w.destroy();
  });

  // ── poll skips when st.size <= taskOffset (no new data) ──
  it('poll skips file when size <= offset', async () => {
    const path = makeFile(dir, 'nodata.jsonl', 'hi\n');
    const st = statSync(path);
    // offset already at file size → no new data
    const fileStates = new Map<string, FileState>([
      [
        path,
        {
          offset: st.size,
          inode: st.ino,
          birthtimeMs: st.birthtimeMs,
          mtimeMs: st.mtimeMs,
          partial: '',
          firstTimestampMs: null,
        },
      ],
    ]);
    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>();

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100, dirScanIntervalMs: 100_000 });
    await advanceAndFlush(0);

    expect(processTask).not.toHaveBeenCalled();
    w.destroy();
  });

  // ── poll: state deleted mid-iteration (!state branch) ──
  it('poll skips path when state was removed mid-iteration', async () => {
    const p1 = makeFile(dir, 'a.jsonl', 'aaa\n');
    const p2 = makeFile(dir, 'b.jsonl', 'bbb\n');
    const fileStates = new Map<string, FileState>([
      [p1, stateFor(p1)],
      [p2, stateFor(p2)],
    ]);

    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>().mockImplementation(async (task) => {
      // When processing first file, delete the second from map
      if (task.path === p1) {
        fileStates.delete(p2);
      }
      return { ...stateFor(task.path), offset: 100 };
    });

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100, dirScanIntervalMs: 100_000 });
    await advanceAndFlush(0);

    // Only p1 should be processed since p2 was deleted
    expect(processTask).toHaveBeenCalledTimes(1);
    expect(processTask.mock.calls[0][0].path).toBe(p1);
    w.destroy();
  });

  // ── poll: stat fails (file deleted between scans) ──
  it('poll handles stat failure gracefully', async () => {
    const path = makeFile(dir, 'vanish.jsonl', 'data\n');
    const fileStates = new Map<string, FileState>([[path, stateFor(path)]]);

    // Delete the file so stat will fail
    rmSync(path);

    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>();
    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100, dirScanIntervalMs: 100_000 });
    await advanceAndFlush(0);

    expect(processTask).not.toHaveBeenCalled();
    w.destroy();
  });

  // ── dirScan: readdir fails (catch branch) ──
  it('dirScan recovers when readdir throws', async () => {
    // Use a non-existent directory
    const badDir = join(dir, 'nonexistent');
    const fileStates = new Map<string, FileState>();
    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>();

    const w = createWatcher({ dir: badDir, fileStates, processTask, pollIntervalMs: 100_000, dirScanIntervalMs: 100 });
    // dirScan fires at t=0, readdir fails, should not crash
    await advanceAndFlush(0);
    expect(fileStates.size).toBe(0);

    // next tick also doesn't crash
    await advanceAndFlush(100);
    expect(fileStates.size).toBe(0);
    w.destroy();
  });

  // ── dirScan: non-.jsonl files are ignored ──
  it('dirScan ignores non-.jsonl files', async () => {
    makeFile(dir, 'readme.txt', 'hello');
    makeFile(dir, 'data.json', '{}');
    makeFile(dir, 'notes.md', '# hi');

    const fileStates = new Map<string, FileState>();
    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>();

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100_000, dirScanIntervalMs: 100 });
    await advanceAndFlush(0);

    expect(fileStates.size).toBe(0);
    w.destroy();
  });

  // ── dirScan: discovers new .jsonl file ──
  it('dirScan discovers new .jsonl file and adds to fileStates', async () => {
    const fileStates = new Map<string, FileState>();
    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>();

    makeFile(dir, 'session.jsonl', '{"ts":1}\n');

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100_000, dirScanIntervalMs: 100 });
    await advanceAndFlush(0);

    const key = join(dir, 'session.jsonl');
    expect(fileStates.has(key)).toBe(true);
    expect(fileStates.get(key)!.offset).toBe(0);
    w.destroy();
  });

  // ── dirScan: stat fails for new file (catch branch line 162-174) ──
  it('dirScan handles stat failure for new file', async () => {
    const filePath = makeFile(dir, 'temp.jsonl', 'data\n');
    const fileStates = new Map<string, FileState>();
    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>();

    // Delete the file after creating it so readdir sees it but stat fails
    rmSync(filePath);
    // Recreate dir listing by making a symlink to nowhere
    // Actually, let's mock stat instead. Simpler: create the file, start watcher, then it works.
    // The tricky part is that readdir succeeds but stat fails.
    // Let's use a broken symlink approach:
    const { symlinkSync } = await import('node:fs');
    symlinkSync('/nonexistent-path-xyz', join(dir, 'broken.jsonl'));

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100_000, dirScanIntervalMs: 100 });
    await advanceAndFlush(0);

    // broken.jsonl stat fails, should not be added but also not crash
    expect(fileStates.has(join(dir, 'broken.jsonl'))).toBe(false);
    w.destroy();
  });

  // ── truncate detection: birthtimeMs change ──
  it('resets offset when birthtimeMs changes', async () => {
    const path = makeFile(dir, 'birth.jsonl', 'original\n');
    const st = statSync(path);
    const fileStates = new Map<string, FileState>([
      [
        path,
        {
          offset: 50,
          inode: st.ino,
          birthtimeMs: st.birthtimeMs - 1000,
          mtimeMs: st.mtimeMs,
          partial: 'old',
          firstTimestampMs: null,
        },
      ],
    ]);

    const processTask = vi.fn<(task: FileTask) => Promise<FileState>>().mockImplementation(async (task) => {
      return { ...fileStates.get(task.path)!, offset: task.offset + 10 };
    });

    const w = createWatcher({ dir, fileStates, processTask, pollIntervalMs: 100, dirScanIntervalMs: 100_000 });
    await advanceAndFlush(0);

    expect(processTask.mock.calls[0][0].offset).toBe(0);
    expect(processTask.mock.calls[0][0].partial).toBe('');
    w.destroy();
  });
});
