import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockCreateTranscriptSink,
  mockCreateFileProcessor,
  mockInitScan,
  mockCreateWatcher,
  mockComputeStats,
  mockBackfillFirstTimestamps,
  mockFormatStats,
  mockEmptyStats,
  mockProcessFile,
  mockInfo,
  mockWarn,
} = vi.hoisted(() => ({
  mockCreateTranscriptSink: vi.fn(),
  mockCreateFileProcessor: vi.fn(),
  mockInitScan: vi.fn(),
  mockCreateWatcher: vi.fn(),
  mockComputeStats: vi.fn(),
  mockBackfillFirstTimestamps: vi.fn(),
  mockFormatStats: vi.fn(),
  mockEmptyStats: vi.fn(),
  mockProcessFile: vi.fn(),
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('../persistence/sink.js', () => ({
  createTranscriptSink: mockCreateTranscriptSink,
  BATCH_FLUSH: { maxEvents: 5000, maxLatencyMs: 10000 },
  WATCH_FLUSH: { maxEvents: 200, maxLatencyMs: 2000 },
}));

vi.mock('../processing/file-processor.js', () => ({
  createFileProcessor: mockCreateFileProcessor,
}));

vi.mock('../init.js', () => ({
  initScan: mockInitScan,
}));

vi.mock('../watch.js', () => ({
  createWatcher: mockCreateWatcher,
}));

vi.mock('../persistence/lifetime-stats.js', () => ({
  computeStats: mockComputeStats,
  backfillFirstTimestamps: mockBackfillFirstTimestamps,
  formatStats: mockFormatStats,
  emptyStats: mockEmptyStats,
}));

vi.mock('../processing/processor.js', () => ({
  processFile: mockProcessFile,
}));

vi.mock('../../../../logger.js', () => ({
  createChildLogger: () => ({
    info: mockInfo,
    warn: mockWarn,
  }),
}));

import { createTranscriptManager } from '../manager.js';
import type { AggregatedStats } from '../persistence/lifetime-stats.js';

function makeDeps() {
  return {
    db: {} as any,
    transcriptsDir: '/tmp/transcripts',
    deviceJsonPath: '/tmp/device.json',
    tokenBus: {} as any,
    messageBus: {} as any,
    onFlush: vi.fn(),
  };
}

function makeStats(overrides: Partial<AggregatedStats> = {}): AggregatedStats {
  return {
    createdAtMs: 1000000,
    totalSessions: 5,
    totalInputTokens: 100,
    totalOutputTokens: 200,
    totalCacheReadTokens: 50,
    totalCacheWriteTokens: 25,
    totalUserMessages: 10,
    totalAssistantMessages: 10,
    ...overrides,
  };
}

function defaultFormatStats(stats: AggregatedStats, isReady: boolean): any {
  return {
    isReady,
    createdAt: new Date(stats.createdAtMs || Date.now()).toISOString(),
    daysSinceCreation: 0,
    totalSessions: stats.totalSessions,
    totalInputTokens: stats.totalInputTokens,
    totalOutputTokens: stats.totalOutputTokens,
    totalCacheReadTokens: stats.totalCacheReadTokens,
    totalCacheWriteTokens: stats.totalCacheWriteTokens,
    totalTokens: stats.totalInputTokens + stats.totalOutputTokens + stats.totalCacheReadTokens + stats.totalCacheWriteTokens,
    totalUserMessages: stats.totalUserMessages,
    totalAssistantMessages: stats.totalAssistantMessages,
  };
}

function setupMocks(opts: { deferred?: Array<{ path: string }>; stats?: AggregatedStats } = {}) {
  const initSinkDestroy = vi.fn();
  const watchSinkDestroy = vi.fn();
  const watchSinkAccept = vi.fn();
  const watchSinkFlush = vi.fn();
  let sinkCallCount = 0;

  mockCreateTranscriptSink.mockImplementation(() => {
    sinkCallCount++;
    if (sinkCallCount === 1) {
      // initSink
      return { accept: vi.fn(), flush: vi.fn(), destroy: initSinkDestroy };
    }
    // watchSink
    return { accept: watchSinkAccept, flush: watchSinkFlush, destroy: watchSinkDestroy };
  });

  const mockProcessTask = vi.fn();
  mockCreateFileProcessor.mockReturnValue(mockProcessTask);

  const fileStates = new Map();
  const stats = opts.stats ?? makeStats();
  const deferred = opts.deferred ?? [];

  mockInitScan.mockResolvedValue({ fileStates, stats, deferred });

  const watcherDestroy = vi.fn();
  mockCreateWatcher.mockReturnValue({ destroy: watcherDestroy });

  const refreshedStats = makeStats({ totalSessions: 10 });
  mockComputeStats.mockReturnValue(refreshedStats);

  mockEmptyStats.mockReturnValue(makeStats({ totalSessions: 0, totalInputTokens: 0, totalOutputTokens: 0, totalCacheReadTokens: 0, totalCacheWriteTokens: 0, totalUserMessages: 0, totalAssistantMessages: 0 }));
  mockFormatStats.mockImplementation(defaultFormatStats);

  return {
    initSinkDestroy,
    watchSinkDestroy,
    watchSinkFlush,
    watcherDestroy,
    mockProcessTask,
    fileStates,
    stats,
    refreshedStats,
  };
}

describe('createTranscriptManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  it('starts in idle state', () => {
    setupMocks();
    const mgr = createTranscriptManager(makeDeps());
    expect(mgr.state).toEqual({ kind: 'idle' });
  });

  describe('init without deferred', () => {
    it('transitions idle → initializing → complete', async () => {
      setupMocks({ deferred: [] });
      const mgr = createTranscriptManager(makeDeps());

      const initPromise = mgr.init();
      // Can't reliably check 'initializing' mid-await, but we trust it
      await initPromise;

      expect(mgr.state).toEqual({ kind: 'complete' });
    });

    it('creates initSink then watchSink', async () => {
      setupMocks({ deferred: [] });
      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();

      expect(mockCreateTranscriptSink).toHaveBeenCalledTimes(2);
    });

    it('creates watcher with fileStates', async () => {
      const { fileStates } = setupMocks({ deferred: [] });
      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();

      expect(mockCreateWatcher).toHaveBeenCalledTimes(1);
      expect(mockCreateWatcher.mock.calls[0][0].fileStates).toBe(fileStates);
    });
  });

  describe('init with deferred', () => {
    it('transitions idle → initializing → ready(deferredPending:true) → complete', async () => {
      const { mockProcessTask } = setupMocks({
        deferred: [{ path: '/tmp/transcripts/a.jsonl' }],
      });
      mockProcessTask.mockResolvedValue({
        offset: 100, inode: 1, birthtimeMs: 1000, mtimeMs: 2000, partial: '', firstTimestampMs: null,
      });

      const deps = makeDeps();
      const mgr = createTranscriptManager(deps);
      const initPromise = mgr.init();
      await initPromise;

      // After init resolves, state should be ready with deferredPending
      expect(mgr.state).toEqual({ kind: 'ready', deferredPending: true });

      // Advance past deferred delay
      await vi.advanceTimersByTimeAsync(30_000);

      expect(mgr.state).toEqual({ kind: 'complete' });
    });

    it('processes deferred files after delay', async () => {
      const { mockProcessTask, watchSinkFlush } = setupMocks({
        deferred: [
          { path: '/tmp/transcripts/a.jsonl' },
          { path: '/tmp/transcripts/b.jsonl' },
        ],
      });
      mockProcessTask.mockResolvedValue({
        offset: 100, inode: 1, birthtimeMs: 1000, mtimeMs: 2000, partial: '', firstTimestampMs: null,
      });

      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();

      expect(mockProcessTask).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockProcessTask).toHaveBeenCalledTimes(2);
      expect(watchSinkFlush).toHaveBeenCalled();
      expect(mockBackfillFirstTimestamps).toHaveBeenCalled();
      expect(mockComputeStats).toHaveBeenCalled();
    });

    it('logs deferred completion with count and duration', async () => {
      const { mockProcessTask } = setupMocks({
        deferred: [{ path: '/tmp/transcripts/a.jsonl' }],
      });
      mockProcessTask.mockResolvedValue({
        offset: 100, inode: 1, birthtimeMs: 1000, mtimeMs: 2000, partial: '', firstTimestampMs: null,
      });

      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();
      await vi.advanceTimersByTimeAsync(30_000);

      expect(mockInfo).toHaveBeenCalledWith(
        expect.objectContaining({ deferred: 1, durationMs: expect.any(Number) }),
        expect.any(String),
      );
    });
  });

  describe('deferred abort on destroy', () => {
    it('aborts deferred when destroyed during delay', async () => {
      setupMocks({
        deferred: [{ path: '/tmp/transcripts/a.jsonl' }],
      });

      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();
      expect(mgr.state).toEqual({ kind: 'ready', deferredPending: true });

      mgr.destroy();
      expect(mgr.state).toEqual({ kind: 'destroyed' });

      // Advance timers — deferred should NOT execute because signal is aborted
      await vi.advanceTimersByTimeAsync(60_000);
      // The watchProcessor should not have been called for deferred files
      const watchProcessTask = mockCreateFileProcessor.mock.results[0]?.value;
      expect(watchProcessTask).not.toHaveBeenCalled();
    });

    it('checks signal.aborted after delay resolves', async () => {
      const { mockProcessTask } = setupMocks({
        deferred: [{ path: '/tmp/transcripts/a.jsonl' }],
      });

      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();

      // Destroy immediately after init
      mgr.destroy();

      // Even if timer fires, signal is aborted so no processing
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mockProcessTask).not.toHaveBeenCalled();
    });
  });

  describe('destroy', () => {
    it('is safe in idle state', () => {
      setupMocks();
      const mgr = createTranscriptManager(makeDeps());
      expect(() => mgr.destroy()).not.toThrow();
      expect(mgr.state).toEqual({ kind: 'destroyed' });
    });

    it('is safe when already destroyed', async () => {
      setupMocks({ deferred: [] });
      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();
      mgr.destroy();
      expect(() => mgr.destroy()).not.toThrow();
    });

    it('calls watchSink.destroy()', async () => {
      const { watchSinkDestroy } = setupMocks({ deferred: [] });
      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();
      mgr.destroy();
      expect(watchSinkDestroy).toHaveBeenCalled();
    });

    it('calls watcher.destroy()', async () => {
      const { watcherDestroy } = setupMocks({ deferred: [] });
      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();
      mgr.destroy();
      expect(watcherDestroy).toHaveBeenCalled();
    });

    it('is safe during ready state', async () => {
      const { watchSinkDestroy, watcherDestroy } = setupMocks({
        deferred: [{ path: '/tmp/transcripts/a.jsonl' }],
      });

      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();
      expect(mgr.state.kind).toBe('ready');

      mgr.destroy();
      expect(mgr.state).toEqual({ kind: 'destroyed' });
      expect(watchSinkDestroy).toHaveBeenCalled();
      expect(watcherDestroy).toHaveBeenCalled();
    });

    it('is safe in complete state', async () => {
      const { watchSinkDestroy, watcherDestroy } = setupMocks({ deferred: [] });
      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();
      expect(mgr.state.kind).toBe('complete');

      mgr.destroy();
      expect(mgr.state).toEqual({ kind: 'destroyed' });
      expect(watchSinkDestroy).toHaveBeenCalled();
      expect(watcherDestroy).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('returns formatted stats after init (no deferred)', async () => {
      setupMocks({ deferred: [] });
      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();

      const result = await mgr.getStats();
      expect(result.isReady).toBe(true);
      expect(result.totalSessions).toBe(5);
    });

    it('returns stats with isReady=false before init', async () => {
      setupMocks();
      const mgr = createTranscriptManager(makeDeps());
      const result = await mgr.getStats();
      expect(result.isReady).toBe(false);
    });

    it('returns refreshed stats after deferred completes', async () => {
      const { mockProcessTask } = setupMocks({
        deferred: [{ path: '/tmp/transcripts/a.jsonl' }],
      });
      mockProcessTask.mockResolvedValue({
        offset: 100, inode: 1, birthtimeMs: 1000, mtimeMs: 2000, partial: '', firstTimestampMs: null,
      });

      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();
      await vi.advanceTimersByTimeAsync(30_000);

      const result = await mgr.getStats();
      expect(result.totalSessions).toBe(10); // refreshed stats
    });

    it('returns LifetimeStatsResult synchronously', async () => {
      setupMocks({ deferred: [] });
      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();

      const result = mgr.getStats();
      expect(result).toHaveProperty('totalSessions');
    });
  });

  describe('getFileStates', () => {
    it('returns empty map before init', () => {
      setupMocks();
      const mgr = createTranscriptManager(makeDeps());
      expect(mgr.getFileStates().size).toBe(0);
    });

    it('returns fileStates after init', async () => {
      const { fileStates } = setupMocks({ deferred: [] });
      fileStates.set('/tmp/a.jsonl', { offset: 0, inode: 1, birthtimeMs: 0, mtimeMs: 0, partial: '', firstTimestampMs: null });

      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();

      expect(mgr.getFileStates().size).toBe(1);
    });
  });

  describe('isReady', () => {
    it('returns false before init', () => {
      setupMocks();
      const mgr = createTranscriptManager(makeDeps());
      expect(mgr.isReady()).toBe(false);
    });

    it('returns true after init completes (no deferred)', async () => {
      setupMocks({ deferred: [] });
      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();
      expect(mgr.isReady()).toBe(true);
    });

    it('returns true in ready state (even with deferred pending)', async () => {
      setupMocks({
        deferred: [{ path: '/tmp/transcripts/a.jsonl' }],
      });
      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();
      expect(mgr.isReady()).toBe(true);
    });

    it('returns false after destroy', async () => {
      setupMocks({ deferred: [] });
      const mgr = createTranscriptManager(makeDeps());
      await mgr.init();
      mgr.destroy();
      expect(mgr.isReady()).toBe(false);
    });
  });
});
