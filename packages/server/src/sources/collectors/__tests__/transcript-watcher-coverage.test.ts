import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Logger mock (hoisted) ──
const mockLog = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }));
vi.mock('../../../logger.js', () => ({ createChildLogger: () => mockLog }));

// ── fs mock ──
vi.mock('node:fs', async () => {
  const actual = await vi.importActual<typeof import('node:fs')>('node:fs');
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    statSync: vi.fn(),
    openSync: vi.fn(() => 99),
    readSync: vi.fn(),
    closeSync: vi.fn(),
    readdirSync: vi.fn(() => []),
  };
});

import { existsSync, readdirSync,readSync, statSync } from 'node:fs';

import type { FileState } from '../lifetime-scanner.js';
import { createTranscriptWatcher } from '../transcript-watcher.js';

const mockExistsSync = existsSync as unknown as ReturnType<typeof vi.fn>;
const mockStatSync = statSync as unknown as ReturnType<typeof vi.fn>;
const mockReadSync = readSync as unknown as ReturnType<typeof vi.fn>;
const mockReaddirSync = readdirSync as unknown as ReturnType<typeof vi.fn>;

function mockBus() {
  // as any — test-only minimal bus
  return { emit: vi.fn(), subscribe: vi.fn(() => () => {}), destroy: vi.fn() } as any;
}

function makeStat(ino = 1, size = 0, birthtimeMs = 1000) {
  return { ino, size, birthtimeMs };
}

describe('transcript-watcher coverage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // 1. start() without emitTo() → throws
  it('throws if start() called without emitTo()', () => {
    const states = new Map<string, FileState>();
    expect(() => createTranscriptWatcher('/tmp/test').start(states)).toThrow('emitTo');
  });

  // 2. start() when dir missing → log.warn
  it('logs warn when dir missing at start', () => {
    mockExistsSync.mockReturnValue(false);
    const w = createTranscriptWatcher('/tmp/missing').emitTo(mockBus(), mockBus()).start(new Map());
    expect(mockLog.warn).toHaveBeenCalledWith(
      expect.objectContaining({ dir: '/tmp/missing' }),
      expect.stringContaining('not found'),
    );
    w.destroy();
  });

  // 3. poll with empty fileStates → no emit
  it('poll with empty fileStates does not emit', () => {
    const tBus = mockBus();
    const w = createTranscriptWatcher('/tmp/t').pollEvery(100).emitTo(tBus, mockBus()).start(new Map());
    vi.advanceTimersByTime(100);
    expect(tBus.emit).not.toHaveBeenCalled();
    w.destroy();
  });

  // 4. truncation (offset > size) → log.info reason:'truncate'
  it('detects truncation and logs reason:truncate', () => {
    const states = new Map<string, FileState>();
    states.set('/tmp/t/a.jsonl', { offset: 500, inode: 1, birthtimeMs: 1000, partialLine: '' });
    mockStatSync.mockReturnValue(makeStat(1, 100, 1000)); // size < offset
    mockReadSync.mockImplementation(() => 0);

    const w = createTranscriptWatcher('/tmp/t').pollEvery(50).emitTo(mockBus(), mockBus()).start(states);

    vi.advanceTimersByTime(50);
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'truncate' }),
      expect.stringContaining('reset'),
    );
    w.destroy();
  });

  // 5. inode change → log.info reason:'inode'
  it('detects inode change and logs reason:inode', () => {
    const states = new Map<string, FileState>();
    states.set('/tmp/t/b.jsonl', { offset: 0, inode: 1, birthtimeMs: 1000, partialLine: '' });
    mockStatSync.mockReturnValue(makeStat(999, 10, 1000)); // different inode
    mockReadSync.mockImplementation(() => 0);

    const w = createTranscriptWatcher('/tmp/t').pollEvery(50).emitTo(mockBus(), mockBus()).start(states);

    vi.advanceTimersByTime(50);
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'inode' }),
      expect.stringContaining('reset'),
    );
    w.destroy();
  });

  // 6. poll read error → log.warn "poll read error"
  it('logs warn on poll read error', () => {
    const states = new Map<string, FileState>();
    states.set('/tmp/t/c.jsonl', { offset: 0, inode: 1, birthtimeMs: 1000, partialLine: '' });
    mockStatSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    const w = createTranscriptWatcher('/tmp/t').pollEvery(50).emitTo(mockBus(), mockBus()).start(states);

    vi.advanceTimersByTime(50);
    expect(mockLog.warn).toHaveBeenCalledWith(expect.objectContaining({ file: 'c.jsonl' }), 'poll read error');
    w.destroy();
  });

  // 7. dirScan discovers new .jsonl
  it('discovers new .jsonl files during dirScan', () => {
    mockReaddirSync.mockReturnValue(['new.jsonl']);
    mockStatSync.mockReturnValue(makeStat(5, 0, 2000));

    const w = createTranscriptWatcher('/tmp/t').dirScanEvery(100).emitTo(mockBus(), mockBus()).start(new Map());

    vi.advanceTimersByTime(100);
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.objectContaining({ file: 'new.jsonl' }),
      expect.stringContaining('discovered'),
    );
    w.destroy();
  });

  // 8. dirScan removes deleted file
  it('removes deleted file during dirScan', () => {
    const states = new Map<string, FileState>();
    states.set('/tmp/t/old.jsonl', { offset: 0, inode: 1, birthtimeMs: 1000, partialLine: '' });
    mockReaddirSync.mockReturnValue([]); // file gone

    const w = createTranscriptWatcher('/tmp/t').dirScanEvery(100).emitTo(mockBus(), mockBus()).start(states);

    vi.advanceTimersByTime(100);
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.objectContaining({ file: 'old.jsonl' }),
      expect.stringContaining('removed'),
    );
    w.destroy();
  });

  // 9. dirScan when dir deleted → no crash
  it('handles dir deletion during dirScan gracefully', () => {
    mockExistsSync.mockReturnValue(true); // start ok
    const w = createTranscriptWatcher('/tmp/t').dirScanEvery(100).emitTo(mockBus(), mockBus()).start(new Map());

    mockExistsSync.mockReturnValue(false); // dir gone at scan time
    expect(() => vi.advanceTimersByTime(100)).not.toThrow();
    w.destroy();
  });

  // 10. onFlush called after poll + on destroy
  it('calls onFlush after poll and on destroy', () => {
    const flush = vi.fn();
    const states = new Map<string, FileState>();
    states.set('/tmp/t/f.jsonl', { offset: 0, inode: 1, birthtimeMs: 1000, partialLine: '' });
    // stat returns same size as offset so no read happens, but poll still runs through
    mockStatSync.mockReturnValue(makeStat(1, 0, 1000));

    const w = createTranscriptWatcher('/tmp/t').pollEvery(50).emitTo(mockBus(), mockBus()).onFlush(flush).start(states);

    vi.advanceTimersByTime(50);
    expect(flush).toHaveBeenCalledTimes(1); // after poll

    w.destroy();
    expect(flush).toHaveBeenCalledTimes(2); // on destroy
  });

  // 11. Builder chains return self
  it('builder methods return self for chaining', () => {
    const b = createTranscriptWatcher('/tmp/t');
    expect(b.pollEvery(100)).toBe(b);
    expect(b.dirScanEvery(200)).toBe(b);
    expect(b.byteBudget(1024)).toBe(b);
    expect(b.emitTo(mockBus(), mockBus())).toBe(b);
    expect(b.onFlush(() => {})).toBe(b);
  });
});
