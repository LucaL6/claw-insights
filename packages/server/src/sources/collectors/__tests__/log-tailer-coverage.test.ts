import { mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';

import { LogTailer } from '../log-tailer';

describe('LogTailer coverage — error paths', () => {
  it('constructor handles missing log file gracefully (stat catch)', () => {
    // Point to a directory that exists but has no log file
    const dir = join(tmpdir(), `lt-cov-${Date.now()}/`);
    mkdirSync(dir, { recursive: true });
    const tailer = new LogTailer(dir);
    // Should initialize with offset=0 since stat throws
    expect(tailer.getRecentEntries(1)).toEqual([]);
    tailer.destroy();
    rmSync(dir, { recursive: true, force: true });
  });

  it('startWatching catch path — watch on nonexistent file', () => {
    // Non-existent directory → watch will throw
    const dir = '/tmp/no-such-dir-' + Date.now() + '/';
    const tailer = new LogTailer(dir);
    expect(tailer.getRecentEntries(1)).toEqual([]);
    tailer.destroy();
  });

  it('date check triggers switchToCurrentFile', () => {
    vi.useFakeTimers();
    const dir = join(tmpdir(), `lt-cov2-${Date.now()}/`);
    mkdirSync(dir, { recursive: true });
    const tailer = new LogTailer(dir);
    // Advance past the 60s date check interval
    vi.advanceTimersByTime(61_000);
    // Should not throw — just silently handles same file
    expect(tailer.getRecentEntries(1)).toEqual([]);
    tailer.destroy();
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });

  it('readIncremental catch path — corrupted file read', () => {
    vi.useFakeTimers();
    const dir = join(tmpdir(), `lt-cov3-${Date.now()}/`);
    mkdirSync(dir, { recursive: true });

    // Create the log file before constructing LogTailer
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const logFile = join(dir, `openclaw-${yyyy}-${mm}-${dd}.log`);
    writeFileSync(logFile, 'initial content\n');

    const tailer = new LogTailer(dir);

    // Delete the file then trigger poll interval to cause a readIncremental error
    rmSync(logFile, { force: true });
    vi.advanceTimersByTime(3000); // trigger poll (2s interval)

    // Should not throw, just log warning
    expect(tailer.getRecentEntries(1)).toEqual([]);
    tailer.destroy();
    vi.useRealTimers();
    rmSync(dir, { recursive: true, force: true });
  });
});
