import { afterEach,beforeEach, describe, expect, it, vi } from 'vitest';

import type { ScanStateRow } from '../../../db/scan-state-queries.js';
import type { FileToScan } from '../file-classifier.js';
import type { ParsedMessageEvent, ParsedTokenEvent } from '../transcript-parser.js';
import type { ScanSink } from '../transcript-scanner.js';

function createSink() {
  const tokens: ParsedTokenEvent[] = [];
  const messages: ParsedMessageEvent[] = [];
  const completions: ScanStateRow[] = [];
  const errors: Array<{ file: string; err: Error }> = [];
  const sink: ScanSink = {
    onToken: (t) => tokens.push(t),
    onMessage: (m) => messages.push(m),
    onFileComplete: (s) => completions.push(s),
  };
  return { sink, tokens, messages, completions, errors };
}

function makeFile(path: string): FileToScan {
  return { path, offset: 0, partial: '', prevFirstTimestampMs: null } as FileToScan;
}

// ── workerCount ──
describe('workerCount', () => {
  const savedEnv = process.env.CLAW_INSIGHTS_SCAN_WORKERS;

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env.CLAW_INSIGHTS_SCAN_WORKERS;
    } else {
      process.env.CLAW_INSIGHTS_SCAN_WORKERS = savedEnv;
    }
  });

  it('returns override when valid ≥ 1', async () => {
    const { workerCount } = await import('../transcript-scanner.js');
    expect(workerCount(3)).toBe(3);
  });

  it('ignores override of 0', async () => {
    const { workerCount } = await import('../transcript-scanner.js');
    const result = workerCount(0);
    expect(result).toBeGreaterThanOrEqual(1);
  });

  it('reads from env when no override', async () => {
    process.env.CLAW_INSIGHTS_SCAN_WORKERS = '2';
    const { workerCount } = await import('../transcript-scanner.js');
    expect(workerCount()).toBe(2);
  });

  it('ignores invalid env value', async () => {
    process.env.CLAW_INSIGHTS_SCAN_WORKERS = 'abc';
    const { workerCount } = await import('../transcript-scanner.js');
    const result = workerCount();
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(4);
  });

  it('ignores missing env value', async () => {
    delete process.env.CLAW_INSIGHTS_SCAN_WORKERS;
    const { workerCount } = await import('../transcript-scanner.js');
    const result = workerCount();
    expect(result).toBeGreaterThanOrEqual(1);
    expect(result).toBeLessThanOrEqual(4);
  });
});

// ── resolveWorkerPath ──
describe('resolveWorkerPath', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns .ts path when it exists', async () => {
    vi.doMock('node:fs', () => ({
      existsSync: (p: string) => p.endsWith('scan-worker.ts'),
    }));
    const { resolveWorkerPath } = await import('../transcript-scanner.js');
    const result = resolveWorkerPath();
    expect(result).toMatch(/scan-worker\.ts$/);
  });

  it('returns .js path when .ts missing but .js exists', async () => {
    vi.doMock('node:fs', () => ({
      existsSync: (p: string) => p.endsWith('scan-worker.js') && !p.includes('dist'),
    }));
    const { resolveWorkerPath } = await import('../transcript-scanner.js');
    const result = resolveWorkerPath();
    expect(result).toMatch(/scan-worker\.js$/);
    expect(result).not.toMatch(/dist/);
  });

  it('returns dist path when neither .ts nor local .js exists', async () => {
    vi.doMock('node:fs', () => ({
      existsSync: () => false,
    }));
    const { resolveWorkerPath } = await import('../transcript-scanner.js');
    const result = resolveWorkerPath();
    expect(result).toMatch(/dist\/scan-worker\.js$/);
  });
});

// ── scanFiles abort signal ──
describe('scanFiles with AbortSignal', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('skips all files when signal is pre-aborted', async () => {
    // Mock stream-scanner so we can detect if it's called
    const mockStreamScan = vi.fn();
    vi.doMock('../stream-scanner.js', () => ({
      streamScanFile: mockStreamScan,
    }));
    // Keep fs real-ish
    vi.doMock('node:fs', () => ({
      existsSync: (p: string) => p.endsWith('scan-worker.ts'),
    }));

    const { scanFiles } = await import('../transcript-scanner.js');
    const { sink } = createSink();
    const ac = new AbortController();
    ac.abort();

    // Use threshold high enough to go main-thread path
    await scanFiles([makeFile('/a.jsonl')], sink, {
      signal: ac.signal,
      workerThreshold: 100,
    });

    expect(mockStreamScan).not.toHaveBeenCalled();
  });

  it('stops mid-batch when signal aborts after yield', async () => {
    const ac = new AbortController();
    let callCount = 0;
    const mockStreamScan = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount >= 2) {
        ac.abort(); // abort after 2nd file processed
      }
      return {
        newOffset: 100,
        inode: 1,
        mtimeMs: 1000,
        birthtimeMs: 500,
        partial: '',
        firstTimestampMs: null,
      };
    });

    vi.doMock('../stream-scanner.js', () => ({
      streamScanFile: mockStreamScan,
    }));
    vi.doMock('node:fs', () => ({
      existsSync: (p: string) => p.endsWith('scan-worker.ts'),
    }));

    const { scanFiles } = await import('../transcript-scanner.js');
    const { sink, completions } = createSink();

    // Create enough files; use batchSize=1 so yield happens after every file
    const files = Array.from({ length: 5 }, (_, i) => makeFile(`/f${i}.jsonl`));
    await scanFiles(files, sink, {
      signal: ac.signal,
      workerThreshold: 100,
      yieldBatchSize: 1,
    });

    // Should have processed at most 2 files before abort detected after yield
    expect(completions.length).toBe(2);
  });
});

// ── scanWithWorkers errors ──
describe('scanWithWorkers via scanFiles', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('falls back to main thread when worker constructor throws (fallback enabled)', async () => {
    const mockStreamScan = vi.fn().mockResolvedValue({
      newOffset: 200,
      inode: 2,
      mtimeMs: 2000,
      birthtimeMs: 1000,
      partial: '',
      firstTimestampMs: null,
    });

    vi.doMock('node:worker_threads', () => ({
      Worker: class {
        constructor() {
          throw new Error('Worker spawn failed');
        }
      },
    }));
    vi.doMock('../stream-scanner.js', () => ({
      streamScanFile: mockStreamScan,
    }));
    vi.doMock('node:fs', () => ({
      existsSync: (p: string) => p.endsWith('scan-worker.ts'),
    }));

    const { scanFiles } = await import('../transcript-scanner.js');
    const { sink, completions } = createSink();

    // workerThreshold=0 forces worker path, workerCount=1
    const files = [makeFile('/a.jsonl')];
    await scanFiles(files, sink, {
      workerThreshold: 0,
      workerCount: 1,
      fallbackToMainThread: true,
    });

    expect(mockStreamScan).toHaveBeenCalled();
    expect(completions.length).toBe(1);
  });

  it('throws when worker fails and fallback disabled', async () => {
    vi.doMock('node:worker_threads', () => ({
      Worker: class {
        constructor() {
          throw new Error('Worker spawn failed');
        }
      },
    }));
    vi.doMock('../stream-scanner.js', () => ({
      streamScanFile: vi.fn(),
    }));
    vi.doMock('node:fs', () => ({
      existsSync: (p: string) => p.endsWith('scan-worker.ts'),
    }));

    const { scanFiles } = await import('../transcript-scanner.js');
    const { sink } = createSink();

    await expect(
      scanFiles([makeFile('/a.jsonl')], sink, {
        workerThreshold: 0,
        workerCount: 1,
        fallbackToMainThread: false,
      }),
    ).rejects.toThrow('Worker failed and fallback disabled');
  });

  it('calls onError for worker result files with fr.error', async () => {
    // Mock Worker that resolves with a file-level error
    vi.doMock('node:worker_threads', () => ({
      Worker: class {
        on(event: string, cb: (...args: unknown[]) => void) {
          if (event === 'message') {
            // Defer to simulate async
            setTimeout(() => {
              cb({
                files: [
                  {
                    path: '/a.jsonl',
                    scan: {} as never,
                    error: 'parse failed',
                  },
                ],
                tokenEvents: [],
                messageEvents: [],
              });
            }, 0);
          }
          // exit and error: no-op
          return this;
        }
      },
    }));
    vi.doMock('../stream-scanner.js', () => ({
      streamScanFile: vi.fn(),
    }));
    vi.doMock('node:fs', () => ({
      existsSync: (p: string) => p.endsWith('scan-worker.ts'),
    }));

    const { scanFiles } = await import('../transcript-scanner.js');
    const { sink, completions } = createSink();
    const errors: Array<{ file: string; err: Error }> = [];

    await scanFiles([makeFile('/a.jsonl')], sink, {
      workerThreshold: 0,
      workerCount: 1,
      onError: (file, err) => errors.push({ file, err }),
    });

    expect(errors.length).toBe(1);
    expect(errors[0].file).toBe('/a.jsonl');
    expect(errors[0].err.message).toBe('parse failed');
    expect(completions.length).toBe(0);
  });
});

// ── Threshold routing ──
describe('threshold routing', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses main thread when file count ≤ threshold', async () => {
    const mockStreamScan = vi.fn().mockResolvedValue({
      newOffset: 50,
      inode: 1,
      mtimeMs: 1000,
      birthtimeMs: 500,
      partial: '',
      firstTimestampMs: null,
    });

    vi.doMock('../stream-scanner.js', () => ({
      streamScanFile: mockStreamScan,
    }));
    vi.doMock('node:fs', () => ({
      existsSync: (p: string) => p.endsWith('scan-worker.ts'),
    }));
    // Worker should NOT be used
    const WorkerSpy = vi.fn();
    vi.doMock('node:worker_threads', () => ({
      Worker: WorkerSpy,
    }));

    const { scanFiles } = await import('../transcript-scanner.js');
    const { sink, completions } = createSink();

    // threshold=5, files=5 → ≤ → main thread
    const files = Array.from({ length: 5 }, (_, i) => makeFile(`/f${i}.jsonl`));
    await scanFiles(files, sink, { workerThreshold: 5 });

    expect(mockStreamScan).toHaveBeenCalledTimes(5);
    expect(WorkerSpy).not.toHaveBeenCalled();
    expect(completions.length).toBe(5);
  });

  it('uses workers when file count > threshold', async () => {
    // Mock Worker that returns successful results
    vi.doMock('node:worker_threads', () => ({
      Worker: class {
        on(event: string, cb: (...args: unknown[]) => void) {
          if (event === 'message') {
            setTimeout(() => {
              cb({
                files: [
                  {
                    path: '/f0.jsonl',
                    scan: {
                      newOffset: 100,
                      inode: 1,
                      mtimeMs: 1000,
                      birthtimeMs: 500,
                      partial: '',
                      firstTimestampMs: null,
                    },
                  },
                  {
                    path: '/f1.jsonl',
                    scan: {
                      newOffset: 100,
                      inode: 2,
                      mtimeMs: 1000,
                      birthtimeMs: 500,
                      partial: '',
                      firstTimestampMs: null,
                    },
                  },
                ],
                tokenEvents: [],
                messageEvents: [],
              });
            }, 0);
          }
          return this;
        }
      },
    }));
    const mockStreamScan = vi.fn();
    vi.doMock('../stream-scanner.js', () => ({
      streamScanFile: mockStreamScan,
    }));
    vi.doMock('node:fs', () => ({
      existsSync: (p: string) => p.endsWith('scan-worker.ts'),
    }));

    const { scanFiles } = await import('../transcript-scanner.js');
    const { sink, completions } = createSink();

    // threshold=1, files=2 → > → workers
    const files = Array.from({ length: 2 }, (_, i) => makeFile(`/f${i}.jsonl`));
    await scanFiles(files, sink, { workerThreshold: 1, workerCount: 1 });

    expect(mockStreamScan).not.toHaveBeenCalled();
    expect(completions.length).toBe(2);
  });
});
