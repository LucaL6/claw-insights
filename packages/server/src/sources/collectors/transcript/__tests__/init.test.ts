import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockLoadScanState,
  mockUpsertScanState,
  mockDeleteScanState,
  mockClassifyFiles,
  mockCreateFileProcessor,
  mockBackfillFirstTimestamps,
  mockComputeStats,
  mockInfo,
  mockWarn,
} = vi.hoisted(() => ({
  mockLoadScanState: vi.fn(),
  mockUpsertScanState: vi.fn(),
  mockDeleteScanState: vi.fn(),
  mockClassifyFiles: vi.fn(),
  mockCreateFileProcessor: vi.fn(),
  mockBackfillFirstTimestamps: vi.fn(),
  mockComputeStats: vi.fn(),
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
}));

vi.mock('../../../../db/scan-state-queries.js', () => ({
  loadScanState: mockLoadScanState,
  upsertScanState: mockUpsertScanState,
  deleteScanState: mockDeleteScanState,
}));

vi.mock('../processing/file-classifier.js', () => ({
  classifyFiles: mockClassifyFiles,
}));

vi.mock('../processing/file-processor.js', () => ({
  createFileProcessor: mockCreateFileProcessor,
}));

vi.mock('../persistence/lifetime-stats.js', () => ({
  backfillFirstTimestamps: mockBackfillFirstTimestamps,
  computeStats: mockComputeStats,
}));

vi.mock('../../../../logger.js', () => ({
  createChildLogger: () => ({
    info: mockInfo,
    warn: mockWarn,
  }),
}));

import { initScan } from '../init.js';

describe('transcript-init', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockLoadScanState.mockReturnValue(new Map());
    mockClassifyFiles.mockReturnValue({ unchanged: new Map(), toScan: [], deleted: [], deferred: [] });
    mockCreateFileProcessor.mockReturnValue(vi.fn());
    mockComputeStats.mockReturnValue({ totalSessions: 0 });
  });

  it('scans recent files and returns deferred without scanning them', async () => {
    const recent = '/tmp/recent.jsonl';
    const stale = '/tmp/stale.jsonl';

    mockClassifyFiles.mockReturnValue({
      unchanged: new Map(),
      toScan: [{ path: recent, offset: 0, partial: '', prevFirstTimestampMs: null }],
      deleted: [],
      deferred: [{ path: stale, offset: 7, partial: 'x', prevFirstTimestampMs: 123 }],
    });

    const processFile = vi.fn().mockResolvedValue({
      offset: 10,
      inode: 111,
      birthtimeMs: 222,
      mtimeMs: 333,
      partial: '',
      firstTimestampMs: 444,
    });
    mockCreateFileProcessor.mockReturnValue(processFile);

    const sink = {
      accept: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    const result = await initScan({
      db: {} as never,
      transcriptsDir: '/tmp',
      deviceJsonPath: '/tmp/device.json',
      process: vi.fn(),
      sink,
    });

    expect(processFile).toHaveBeenCalledTimes(1);
    expect(processFile).toHaveBeenCalledWith(expect.objectContaining({ path: recent }));
    expect(result.deferred).toHaveLength(1);
    expect(result.deferred[0].path).toBe(stale);
  });

  it('restores unchanged and deferred states', async () => {
    const unchangedPath = '/tmp/a.jsonl';
    const deferredPath = '/tmp/b.jsonl';

    const cached = new Map([
      [
        deferredPath,
        {
          filePath: deferredPath,
          byteOffset: 5,
          inode: 6,
          mtimeMs: 7,
          birthMs: 8,
          partial: 'tail',
          firstTimestampMs: 9,
        },
      ],
    ]);

    mockLoadScanState.mockReturnValue(cached);
    mockClassifyFiles.mockReturnValue({
      unchanged: new Map([[unchangedPath, { offset: 1, inode: 2, birthtimeMs: 3, partial: 'u' }]]),
      toScan: [],
      deleted: [],
      deferred: [{ path: deferredPath, offset: 5, partial: 'tail', prevFirstTimestampMs: 9 }],
    });

    const sink = {
      accept: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    const result = await initScan({
      db: {} as never,
      transcriptsDir: '/tmp',
      deviceJsonPath: '/tmp/device.json',
      process: vi.fn(),
      sink,
    });

    expect(result.fileStates.get(unchangedPath)).toEqual({ offset: 1, inode: 2, birthtimeMs: 3, partial: 'u' });
    expect(result.fileStates.get(deferredPath)).toEqual({ offset: 5, inode: 6, birthtimeMs: 8, partial: 'tail' });
  });

  it('deletes removed scan_state entries', async () => {
    mockClassifyFiles.mockReturnValue({
      unchanged: new Map(),
      toScan: [],
      deleted: ['/tmp/gone.jsonl'],
      deferred: [],
    });

    const sink = {
      accept: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    await initScan({
      db: {} as never,
      transcriptsDir: '/tmp',
      deviceJsonPath: '/tmp/device.json',
      process: vi.fn(),
      sink,
    });

    expect(mockDeleteScanState).toHaveBeenCalledWith(expect.anything(), ['/tmp/gone.jsonl']);
  });

  it('computes stats and backfills first timestamps', async () => {
    const stats = { totalSessions: 42 };
    mockComputeStats.mockReturnValue(stats);

    const sink = {
      accept: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    const result = await initScan({
      db: {} as never,
      transcriptsDir: '/tmp',
      deviceJsonPath: '/tmp/device.json',
      process: vi.fn(),
      sink,
    });

    expect(mockBackfillFirstTimestamps).toHaveBeenCalled();
    expect(mockComputeStats).toHaveBeenCalled();
    expect(result.stats).toBe(stats);
  });

  it('stops scanning when aborted', async () => {
    const ac = new AbortController();
    const files = ['/tmp/a.jsonl', '/tmp/b.jsonl'];

    mockClassifyFiles.mockReturnValue({
      unchanged: new Map(),
      toScan: files.map((path) => ({ path, offset: 0, partial: '', prevFirstTimestampMs: null })),
      deleted: [],
      deferred: [],
    });

    const processFile = vi.fn().mockImplementation(async () => {
      ac.abort();
      return {
        offset: 1,
        inode: 1,
        birthtimeMs: 1,
        mtimeMs: 1,
        partial: '',
        firstTimestampMs: null,
      };
    });
    mockCreateFileProcessor.mockReturnValue(processFile);

    const sink = {
      accept: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    await initScan({
      db: {} as never,
      transcriptsDir: '/tmp',
      deviceJsonPath: '/tmp/device.json',
      process: vi.fn(),
      sink,
      signal: ac.signal,
    });

    expect(processFile).toHaveBeenCalledTimes(1);
  });

  it('handles empty classification result', async () => {
    const processFile = vi.fn();
    mockCreateFileProcessor.mockReturnValue(processFile);

    const sink = {
      accept: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    const result = await initScan({
      db: {} as never,
      transcriptsDir: '/tmp/empty',
      deviceJsonPath: '/tmp/device.json',
      process: vi.fn(),
      sink,
    });

    expect(processFile).not.toHaveBeenCalled();
    expect(result.fileStates.size).toBe(0);
  });

  it('always flushes and destroys sink', async () => {
    mockClassifyFiles.mockReturnValue({
      unchanged: new Map(),
      toScan: [{ path: '/tmp/fail.jsonl', offset: 0, partial: '', prevFirstTimestampMs: null }],
      deleted: [],
      deferred: [],
    });

    const processFile = vi.fn().mockRejectedValue(new Error('boom'));
    mockCreateFileProcessor.mockReturnValue(processFile);

    const sink = {
      accept: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    await initScan({
      db: {} as never,
      transcriptsDir: '/tmp',
      deviceJsonPath: '/tmp/device.json',
      process: vi.fn(),
      sink,
    });

    // flush is called internally by destroy — no separate flush call
    expect(sink.flush).toHaveBeenCalledTimes(0);
    expect(sink.destroy).toHaveBeenCalledTimes(1);
  });

  it('logs summary with scanned/total/deferred/durationMs and basename-only warn file', async () => {
    mockClassifyFiles.mockReturnValue({
      unchanged: new Map([[ '/tmp/unchanged.jsonl', { offset: 1, inode: 1, birthtimeMs: 1, partial: '' } ]]),
      toScan: [{ path: '/tmp/warn-me.jsonl', offset: 0, partial: '', prevFirstTimestampMs: null }],
      deleted: ['/tmp/deleted.jsonl'],
      deferred: [{ path: '/tmp/stale.jsonl', offset: 0, partial: '', prevFirstTimestampMs: null }],
    });

    const processFile = vi.fn().mockRejectedValue(new Error('fail'));
    mockCreateFileProcessor.mockReturnValue(processFile);

    const sink = {
      accept: vi.fn(),
      flush: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn().mockResolvedValue(undefined),
    };

    await initScan({
      db: {} as never,
      transcriptsDir: '/tmp',
      deviceJsonPath: '/tmp/device.json',
      process: vi.fn(),
      sink,
    });

    expect(mockWarn).toHaveBeenCalledWith(
      expect.objectContaining({ file: 'warn-me.jsonl' }),
      'init scan file failed',
    );
    const warnArg = mockWarn.mock.calls[0]?.[0] as { file?: string };
    expect(warnArg.file).not.toContain('/tmp/');

    expect(mockInfo).toHaveBeenCalledWith(
      expect.objectContaining({
        scanned: 0,
        total: 4,
        deferred: 1,
        durationMs: expect.any(Number),
      }),
      'init scan complete',
    );
  });
});
