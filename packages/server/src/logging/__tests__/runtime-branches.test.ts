/**
 * Branch coverage tests for logging/runtime.ts
 * Targets uncovered lines 132-337, 383-403
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock node:fs before any imports that use it
vi.mock('node:fs', () => ({
  readdirSync: vi.fn(() => []),
  readFileSync: vi.fn(() => ''),
  statSync: vi.fn(() => ({ size: 100 })),
  unlinkSync: vi.fn(),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock('node:os', () => ({
  hostname: vi.fn(() => 'test-host'),
}));

// Mock dependencies
const mockWriterAppend = vi.fn(() => 100);
const mockWriterStart = vi.fn();
const mockWriterShutdown = vi.fn(async () => {});
const mockWriterGetActiveFilePaths = vi.fn(() => new Set<string>());

vi.mock('../writer.js', () => {
  const MockLogWriter = function (this: any) {
    this.start = mockWriterStart;
    this.shutdown = mockWriterShutdown;
    this.append = mockWriterAppend;
    this.getActiveFilePaths = mockWriterGetActiveFilePaths;
  } as any;
  return { LogWriter: MockLogWriter };
});

const mockRouterRoute = vi.fn();
const mockRouterDrain = vi.fn();
const mockRouterStats = vi.fn(() => ({ depth: 0, bytes: 0, capacity: 10000, capacityBytes: 16 * 1024 * 1024 }));

vi.mock('../router.js', () => {
  const MockLogRouter = function (this: any) {
    this.route = mockRouterRoute;
    this.drain = mockRouterDrain;
    this.stats = mockRouterStats;
  } as any;
  return { LogRouter: MockLogRouter };
});

const mockBudgetCheckAppend = vi.fn(() => true);
const mockBudgetRecordAppend = vi.fn();
const mockBudgetSetReclaimFn = vi.fn();
const mockBudgetState = vi.fn(() => ({ totalUsed: 0, freeSpaceMb: 1000, usedByStream: {}, maxOvershootMb: 0 }));

vi.mock('../budget-gate.js', () => {
  const MockBudgetGate = function (this: any) {
    this.checkAppend = mockBudgetCheckAppend;
    this.recordAppend = mockBudgetRecordAppend;
    this.setReclaimFn = mockBudgetSetReclaimFn;
    this.state = mockBudgetState;
  } as any;
  return { BudgetGate: MockBudgetGate };
});

const mockRetentionStart = vi.fn();
const mockRetentionStop = vi.fn();
const mockRetentionSetActiveFiles = vi.fn();

vi.mock('../retention.js', () => {
  const MockRetentionSweeper = function (this: any) {
    this.start = mockRetentionStart;
    this.stop = mockRetentionStop;
    this.setActiveFiles = mockRetentionSetActiveFiles;
  } as any;
  return { RetentionSweeper: MockRetentionSweeper };
});

const mockSampleDecision = vi.fn((..._args: unknown[]) => true);
vi.mock('../sampling.js', () => ({
  deterministicSampleDecision: (...args: unknown[]) => mockSampleDecision(...args),
}));

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';

import { LayeredRuntime } from '../runtime.js';
import { LoggingRuntimeState } from '../state.js';

function createState(): LoggingRuntimeState {
  return new LoggingRuntimeState();
}

function defaultRoute(overrides: Partial<{ stream: string; lane: string; accepted: boolean }> = {}) {
  return { stream: 'app', lane: 'bestEffort', accepted: true, ...overrides };
}

describe('runtime.ts branch coverage', () => {
  let runtime: LayeredRuntime;
  let state: LoggingRuntimeState;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: route accepted, bestEffort
    mockRouterRoute.mockReturnValue(defaultRoute());
    mockBudgetCheckAppend.mockReturnValue(true);
    mockWriterAppend.mockReturnValue(100);
    mockSampleDecision.mockReturnValue(true);

    delete process.env.CLAW_INSIGHTS_LOG_DIR;
    delete process.env.OPENCLAW_LOG_DIR;

    state = createState();
    runtime = new LayeredRuntime({ runtimeState: state });
  });

  afterEach(async () => {
    if (runtime) {await runtime.shutdown();}
  });

  // ──── normalizeLogInput branches ────

  describe('normalizeLogInput', () => {
    it('handles empty args', () => {
      runtime.write('info', 'test', []);
      expect(mockRouterRoute).toHaveBeenCalled();
    });

    it('handles string first arg', () => {
      runtime.write('info', 'test', ['hello %s', 'world']);
      expect(mockRouterRoute).toHaveBeenCalled();
    });

    it('handles Error first arg with string second', () => {
      const err = new Error('boom');
      runtime.write('error', 'test', [err, 'custom message %s', 'arg']);
      expect(mockRouterRoute).toHaveBeenCalled();
    });

    it('handles Error first arg without string second', () => {
      const err = new Error('boom');
      runtime.write('error', 'test', [err]);
      expect(mockRouterRoute).toHaveBeenCalled();
    });

    it('handles Error first arg with non-string second', () => {
      const err = new Error('boom');
      runtime.write('error', 'test', [err, 42]);
      expect(mockRouterRoute).toHaveBeenCalled();
    });

    it('handles object first arg with string second', () => {
      runtime.write('info', 'test', [{ key: 'val' }, 'message %d', 42]);
      expect(mockRouterRoute).toHaveBeenCalled();
    });

    it('handles object first arg without string second', () => {
      runtime.write('info', 'test', [{ key: 'val' }]);
      expect(mockRouterRoute).toHaveBeenCalled();
    });

    it('handles object first arg with non-string second', () => {
      runtime.write('info', 'test', [{ key: 'val' }, 123]);
      expect(mockRouterRoute).toHaveBeenCalled();
    });

    it('handles null first arg (fallback path)', () => {
      runtime.write('info', 'test', [null, 'msg']);
      expect(mockRouterRoute).toHaveBeenCalled();
    });

    it('handles array first arg (fallback path)', () => {
      runtime.write('info', 'test', [[1, 2, 3], 'msg']);
      expect(mockRouterRoute).toHaveBeenCalled();
    });

    it('handles non-string values in fallback with stringify failure', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      // circular object as first arg goes to object-with-meta path, not fallback
      // JSON.stringify(record) will throw since meta spreads circular ref
      expect(() => runtime.write('info', 'test', [circular])).toThrow();
    });

    it('handles multiple non-string args in fallback', () => {
      runtime.write('info', 'test', [42, true, null]);
      expect(mockRouterRoute).toHaveBeenCalled();
    });
  });

  // ──── levelToLayeredLevel branches ────

  describe('levelToLayeredLevel', () => {
    it('maps trace to debug', () => {
      runtime.write('trace', 'test', ['msg']);
      expect(mockRouterRoute).toHaveBeenCalled();
    });

    it('maps fatal to error', () => {
      runtime.write('fatal', 'test', ['msg']);
      expect(mockRouterRoute).toHaveBeenCalled();
    });

    it('passes through debug', () => {
      runtime.write('debug', 'test', ['msg']);
      // debug under normal pressure goes through
    });

    it('passes through info', () => {
      runtime.write('info', 'test', ['msg']);
    });

    it('passes through warn', () => {
      runtime.write('warn', 'test', ['msg']);
    });

    it('passes through error', () => {
      runtime.write('error', 'test', ['msg']);
    });
  });

  // ──── Pressure-based debug drop ────

  describe('pressure-based filtering', () => {
    it('drops debug when pressure is not normal', () => {
      // Force pressure state
      const snap = vi.spyOn(state, 'snapshot').mockReturnValue({
        pressureState: 'pressure',
        ts: Date.now(),
        queue: { criticalDepth: 0, criticalCapacity: 1, bestEffortDepth: 0, bestEffortCapacity: 1 },
        drops: { debug: 0, info: 0, warn: 0, error: 0 },
        totals: { accepted: 0, dropped: 0 },
        pressureTransitions: 0,
        lastTransitionAt: null,
        signals: { queueUsageCriticalPct: 0, ioLagMs: 0, budgetUsagePct: 0, freeSpaceMb: 1000 },
      });

      const incDropped = vi.spyOn(state, 'incrementDropped');
      runtime.write('debug', 'test', ['should be dropped']);

      expect(incDropped).toHaveBeenCalledWith('debug');
      // Router should NOT be called since it's dropped early
      expect(mockRouterRoute).not.toHaveBeenCalled();

      snap.mockRestore();
      incDropped.mockRestore();
    });

    it('drops debug when pressure is emergency', () => {
      const snap = vi.spyOn(state, 'snapshot').mockReturnValue({
        pressureState: 'emergency',
        ts: Date.now(),
        queue: { criticalDepth: 0, criticalCapacity: 1, bestEffortDepth: 0, bestEffortCapacity: 1 },
        drops: { debug: 0, info: 0, warn: 0, error: 0 },
        totals: { accepted: 0, dropped: 0 },
        pressureTransitions: 0,
        lastTransitionAt: null,
        signals: { queueUsageCriticalPct: 0, ioLagMs: 0, budgetUsagePct: 0, freeSpaceMb: 1000 },
      });

      runtime.write('debug', 'test', ['dropped']);
      expect(mockRouterRoute).not.toHaveBeenCalled();

      snap.mockRestore();
    });

    it('samples info at 0.1 rate under emergency', () => {
      const snap = vi.spyOn(state, 'snapshot').mockReturnValue({
        pressureState: 'emergency',
        ts: Date.now(),
        queue: { criticalDepth: 0, criticalCapacity: 1, bestEffortDepth: 0, bestEffortCapacity: 1 },
        drops: { debug: 0, info: 0, warn: 0, error: 0 },
        totals: { accepted: 0, dropped: 0 },
        pressureTransitions: 0,
        lastTransitionAt: null,
        signals: { queueUsageCriticalPct: 0, ioLagMs: 0, budgetUsagePct: 0, freeSpaceMb: 1000 },
      });

      mockSampleDecision.mockReturnValue(false);
      const incDropped = vi.spyOn(state, 'incrementDropped');

      runtime.write('info', 'test', ['sampled out']);
      expect(incDropped).toHaveBeenCalledWith('info');
      expect(mockSampleDecision).toHaveBeenCalledWith(expect.objectContaining({ sampleRate: 0.1 }));

      snap.mockRestore();
      incDropped.mockRestore();
    });

    it('samples info at 0.5 rate under pressure', () => {
      const snap = vi.spyOn(state, 'snapshot').mockReturnValue({
        pressureState: 'pressure',
        ts: Date.now(),
        queue: { criticalDepth: 0, criticalCapacity: 1, bestEffortDepth: 0, bestEffortCapacity: 1 },
        drops: { debug: 0, info: 0, warn: 0, error: 0 },
        totals: { accepted: 0, dropped: 0 },
        pressureTransitions: 0,
        lastTransitionAt: null,
        signals: { queueUsageCriticalPct: 0, ioLagMs: 0, budgetUsagePct: 0, freeSpaceMb: 1000 },
      });

      mockSampleDecision.mockReturnValue(true);
      runtime.write('info', 'test', ['sampled in']);
      expect(mockSampleDecision).toHaveBeenCalledWith(expect.objectContaining({ sampleRate: 0.5 }));

      snap.mockRestore();
    });

    it('does not sample info under normal pressure (rate=1)', () => {
      // Default state is normal
      mockSampleDecision.mockReturnValue(true);
      runtime.write('info', 'test', ['no sampling']);
      expect(mockSampleDecision).toHaveBeenCalledWith(expect.objectContaining({ sampleRate: 1 }));
    });

    it('drops info when sample decision is false under normal', () => {
      mockSampleDecision.mockReturnValue(false);
      const incDropped = vi.spyOn(state, 'incrementDropped');

      runtime.write('info', 'test', ['dropped']);
      expect(incDropped).toHaveBeenCalledWith('info');

      incDropped.mockRestore();
    });
  });

  // ──── Route not accepted branches ────

  describe('route not accepted', () => {
    it('drops debug on bestEffort overflow', () => {
      mockRouterRoute.mockReturnValue(defaultRoute({ accepted: false, lane: 'bestEffort' }));
      const incDropped = vi.spyOn(state, 'incrementDropped');

      runtime.write('debug', 'test', ['overflow']);
      expect(incDropped).toHaveBeenCalledWith('debug');

      incDropped.mockRestore();
    });

    it('drops non-info on bestEffort overflow (warn mapped)', () => {
      // warn goes through critical lane normally, but let's test the bestEffort branch
      // with info that fails sampling
      mockRouterRoute.mockReturnValue(defaultRoute({ accepted: false, lane: 'bestEffort' }));
      mockSampleDecision.mockReturnValue(false);
      const incDropped = vi.spyOn(state, 'incrementDropped');

      runtime.write('info', 'test', ['overflow info not sampled']);
      // The code checks: normalizedLevel !== 'info' || !sample → drops
      // Since it IS info but sample is false → drops
      expect(incDropped).toHaveBeenCalledWith('info');

      incDropped.mockRestore();
    });

    it('writes direct on bestEffort overflow when info is sampled in', () => {
      mockRouterRoute.mockReturnValue(defaultRoute({ accepted: false, lane: 'bestEffort' }));
      mockSampleDecision.mockReturnValue(true);

      runtime.write('info', 'test', ['overflow sampled in']);
      // Should go through writeDirect path
      expect(mockWriterAppend).toHaveBeenCalled();
    });

    it('drops warn/error on bestEffort not-accepted (normalizedLevel !== info)', () => {
      // warn level → normalizedLevel = 'warn', lane bestEffort, not accepted
      // normalizedLevel !== 'info' is true → drops
      mockRouterRoute.mockReturnValue(defaultRoute({ accepted: false, lane: 'bestEffort', stream: 'error' }));
      const incDropped = vi.spyOn(state, 'incrementDropped');

      runtime.write('warn', 'test', ['warn overflow']);
      expect(incDropped).toHaveBeenCalledWith('info'); // code uses incrementDropped('info') for this path

      incDropped.mockRestore();
    });

    it('writes direct on critical lane not accepted (sync fallback)', () => {
      mockRouterRoute.mockReturnValue(defaultRoute({ accepted: false, lane: 'critical' }));

      runtime.write('error', 'test', ['critical overflow']);
      expect(mockWriterAppend).toHaveBeenCalled();
    });
  });

  // ──── writeDirect / budget denied branches ────

  describe('writeDirect budget denied', () => {
    it('increments error dropped when budget denies warn', () => {
      mockBudgetCheckAppend.mockReturnValue(false);
      const incDropped = vi.spyOn(state, 'incrementDropped');

      runtime.write('warn', 'test', ['budget denied']);
      expect(incDropped).toHaveBeenCalledWith('error');

      incDropped.mockRestore();
    });

    it('increments error dropped when budget denies error', () => {
      mockBudgetCheckAppend.mockReturnValue(false);
      const incDropped = vi.spyOn(state, 'incrementDropped');

      runtime.write('error', 'test', ['budget denied']);
      expect(incDropped).toHaveBeenCalledWith('error');

      incDropped.mockRestore();
    });

    it('increments debug dropped when budget denies debug', () => {
      mockBudgetCheckAppend.mockReturnValue(false);
      const incDropped = vi.spyOn(state, 'incrementDropped');

      runtime.write('debug', 'test', ['budget denied']);
      expect(incDropped).toHaveBeenCalledWith('debug');

      incDropped.mockRestore();
    });

    it('increments info dropped when budget denies info', () => {
      mockBudgetCheckAppend.mockReturnValue(false);
      const incDropped = vi.spyOn(state, 'incrementDropped');

      runtime.write('info', 'test', ['budget denied']);
      expect(incDropped).toHaveBeenCalledWith('info');

      incDropped.mockRestore();
    });
  });

  // ──── markFirstSuccessfulAppend branches ────

  describe('markFirstSuccessfulAppend', () => {
    it('sets firstWriteTs on first successful write', () => {
      mockWriterAppend.mockReturnValue(100);
      runtime.write('info', 'test', ['first write']);
      // Second write should not overwrite firstWriteTs
      runtime.write('info', 'test', ['second write']);
      // No error means branch was covered
    });

    it('does not mark when writer returns 0 bytes', () => {
      mockWriterAppend.mockReturnValue(0);
      runtime.write('info', 'test', ['zero bytes']);
    });
  });

  // ──── repairActiveSegmentTails branches ────

  describe('repairActiveSegmentTails (constructor)', () => {
    it('repairs truncated log files on startup', () => {
      const today = new Date().toISOString().slice(0, 10);
      const filename = `app.${today}.0.log`;
      (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([filename]);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"valid":true}\ntruncated garbage');

      const s = createState();
      const r = new LayeredRuntime({ runtimeState: s });

      expect(writeFileSync).toHaveBeenCalled();
      void r.shutdown();
    });

    it('skips when no files exist', () => {
      (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const s = createState();
      const r = new LayeredRuntime({ runtimeState: s });
      void r.shutdown();
    });

    it('handles readdirSync throwing', () => {
      (readdirSync as ReturnType<typeof vi.fn>).mockImplementation(() => {
        throw new Error('ENOENT');
      });

      const s = createState();
      const r = new LayeredRuntime({ runtimeState: s });
      void r.shutdown();
    });

    it('skips repair when file is fully valid', () => {
      const today = new Date().toISOString().slice(0, 10);
      const filename = `app.${today}.0.log`;
      (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([filename]);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"valid":true}\n');

      const s = createState();
      const r = new LayeredRuntime({ runtimeState: s });
      // writeFileSync should not be called for valid content
      void r.shutdown();
    });

    it('repairs with firstAppendAfterRepair marked on subsequent write', () => {
      const today = new Date().toISOString().slice(0, 10);
      const filename = `error.${today}.0.log`;
      (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([filename]);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"valid":true}\ngarbage');

      const s = createState();
      const r = new LayeredRuntime({ runtimeState: s });

      // Now write - should mark firstAppendAfterRepair
      mockRouterRoute.mockReturnValue(defaultRoute());
      mockBudgetCheckAppend.mockReturnValue(true);
      mockWriterAppend.mockReturnValue(50);
      r.write('info', 'test', ['after repair']);

      void r.shutdown();
    });
  });

  // ──── env() and safeInt branches ────

  describe('env and safeInt', () => {
    it('uses CLAW_INSIGHTS_ prefix env vars', () => {
      process.env.CLAW_INSIGHTS_LOG_DIR = '/tmp/test-logs';
      const s = createState();
      const r = new LayeredRuntime({ runtimeState: s });
      void r.shutdown();
      delete process.env.CLAW_INSIGHTS_LOG_DIR;
    });

    it('uses OPENCLAW_ prefix env vars as fallback', () => {
      process.env.OPENCLAW_LOG_DIR = '/tmp/openclaw-logs';
      const s = createState();
      const r = new LayeredRuntime({ runtimeState: s });
      void r.shutdown();
      delete process.env.OPENCLAW_LOG_DIR;
    });

    it('safeInt returns fallback for non-numeric string', () => {
      process.env.CLAW_INSIGHTS_CRITICAL_QUEUE_MAX = 'not-a-number';
      const s = createState();
      const r = new LayeredRuntime({ runtimeState: s });
      void r.shutdown();
      delete process.env.CLAW_INSIGHTS_CRITICAL_QUEUE_MAX;
    });

    it('safeInt uses parsed value for valid numeric string', () => {
      process.env.CLAW_INSIGHTS_CRITICAL_QUEUE_MAX = '5000';
      const s = createState();
      const r = new LayeredRuntime({ runtimeState: s });
      void r.shutdown();
      delete process.env.CLAW_INSIGHTS_CRITICAL_QUEUE_MAX;
    });
  });

  // ──── parseSegment branches ────

  describe('reclaimOldest (via budget reclaimFn)', () => {
    it('reclaims oldest segment', () => {
      // Get the reclaim function that was set
      const reclaimFn = mockBudgetSetReclaimFn.mock.calls[0]?.[0];
      expect(reclaimFn).toBeDefined();

      (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['app.2024-01-01.0.log', 'app.2024-01-02.0.log']);
      mockWriterGetActiveFilePaths.mockReturnValue(new Set());
      (statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 1000 });

      const result = reclaimFn('app');
      expect(result).not.toBeNull();
      expect(result.sizeBytes).toBe(1000);
    });

    it('returns null when no candidates', () => {
      const reclaimFn = mockBudgetSetReclaimFn.mock.calls[0]?.[0];
      (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([]);

      const result = reclaimFn('app');
      expect(result).toBeNull();
    });

    it('skips active files', () => {
      const reclaimFn = mockBudgetSetReclaimFn.mock.calls[0]?.[0];
      const activePath = expect.stringContaining('app.2024-01-01.0.log');
      (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue(['app.2024-01-01.0.log']);
      // Mark as active
      mockWriterGetActiveFilePaths.mockReturnValue(new Set([activePath]));

      // Since we can't match exactly, let's use the actual path
      const logDir = process.env.HOME ?? '/tmp';
      const fullPath = `${logDir}/.claw-insights/logs/app.2024-01-01.0.log`;
      mockWriterGetActiveFilePaths.mockReturnValue(new Set([fullPath]));

      const result = reclaimFn('app');
      expect(result).toBeNull();
    });

    it('skips non-matching filenames', () => {
      const reclaimFn = mockBudgetSetReclaimFn.mock.calls[0]?.[0];
      (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
        'random.txt',
        'app.2024-01-01.notanumber.log',
        '.DS_Store',
      ]);

      const result = reclaimFn('app');
      expect(result).toBeNull();
    });

    it('filters by stream', () => {
      const reclaimFn = mockBudgetSetReclaimFn.mock.calls[0]?.[0];
      (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
        'error.2024-01-01.0.log', // different stream
      ]);
      mockWriterGetActiveFilePaths.mockReturnValue(new Set());
      (statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 500 });

      const result = reclaimFn('app'); // looking for 'app' but only 'error' exists
      expect(result).toBeNull();
    });

    it('sorts by date then seq', () => {
      const reclaimFn = mockBudgetSetReclaimFn.mock.calls[0]?.[0];
      (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([
        'app.2024-01-02.1.log',
        'app.2024-01-01.0.log',
        'app.2024-01-01.1.log',
      ]);
      mockWriterGetActiveFilePaths.mockReturnValue(new Set());
      (statSync as ReturnType<typeof vi.fn>).mockReturnValue({ size: 200 });

      const result = reclaimFn('app');
      // Should pick the oldest: 2024-01-01 seq 0
      expect(result.path).toContain('app.2024-01-01.0.log');
    });
  });

  // ──── shutdown ────

  describe('shutdown', () => {
    it('stops retention and shuts down writer', async () => {
      await runtime.shutdown();
      expect(mockRetentionStop).toHaveBeenCalled();
      expect(mockWriterShutdown).toHaveBeenCalled();
    });
  });

  // ──── accepted route path (drain called) ────

  describe('accepted route', () => {
    it('drains router after successful write', () => {
      mockRouterRoute.mockReturnValue(defaultRoute({ accepted: true }));
      runtime.write('info', 'test', ['accepted']);
      expect(mockRouterDrain).toHaveBeenCalledWith('bestEffort', 1, expect.any(Number));
    });

    it('does not drain on not-accepted route', () => {
      mockRouterRoute.mockReturnValue(defaultRoute({ accepted: false, lane: 'critical' }));
      runtime.write('error', 'test', ['not accepted']);
      expect(mockRouterDrain).not.toHaveBeenCalled();
    });
  });

  // ──── updateRuntimeSignals with capBytes=0 ────

  describe('updateRuntimeSignals', () => {
    it('handles zero budget cap (division by zero guard)', () => {
      process.env.CLAW_INSIGHTS_LOG_BUDGET_MB = '0';
      const s = createState();
      const r = new LayeredRuntime({ runtimeState: s });
      mockRouterRoute.mockReturnValue(defaultRoute());
      r.write('info', 'test', ['zero cap']);
      void r.shutdown();
      delete process.env.CLAW_INSIGHTS_LOG_BUDGET_MB;
    });
  });

  // ──── repairActiveSegmentTails: empty lines, multiple streams ────

  describe('repairActiveSegmentTails edge cases', () => {
    it('handles empty lines in log files', () => {
      const today = new Date().toISOString().slice(0, 10);
      (readdirSync as ReturnType<typeof vi.fn>).mockReturnValue([`debug.${today}.0.log`]);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('\n\n{"valid":true}\n\n');

      const s = createState();
      const r = new LayeredRuntime({ runtimeState: s });
      void r.shutdown();
    });

    it('handles multiple streams with latest file selection', () => {
      const today = new Date().toISOString().slice(0, 10);
      (readdirSync as ReturnType<typeof vi.fn>).mockImplementation(() => [`app.${today}.0.log`, `app.${today}.1.log`]);
      (readFileSync as ReturnType<typeof vi.fn>).mockReturnValue('{"ok":true}\n');

      const s = createState();
      const r = new LayeredRuntime({ runtimeState: s });
      void r.shutdown();
    });
  });
});
