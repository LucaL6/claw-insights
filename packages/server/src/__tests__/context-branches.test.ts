import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock logger to capture structured log calls
const { mockLogError } = vi.hoisted(() => ({ mockLogError: vi.fn() }));
vi.mock('../logger.js', () => ({
  createChildLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: mockLogError, debug: vi.fn() }),
}));

// Mock everything for createContext tests
vi.mock('../config.js', () => ({
  config: {
    dbPath: ':memory:',
    sessionsPath: '/tmp/test-sessions',
    cronPath: '/tmp/test-cron',
    logDir: '/tmp/test-logs',
    rawRetentionDays: 7,
    hourlyRetention: '30',
    aggregateIntervalMs: 60000,
    transcriptsDir: '/tmp/transcripts',
    deviceJsonPath: '/tmp/device.json',
  },
}));

vi.mock('../db/init.js', () => ({
  initDatabase: vi.fn(() => ({
    exec: vi.fn(),
    prepare: vi.fn(() => ({ run: vi.fn(), get: vi.fn(), all: vi.fn() })),
    close: vi.fn(),
  })),
}));

vi.mock('../pipeline/index.js', () => ({
  Pipeline: class {
    addSource() {
      return this;
    }
    addManaged() {
      return this;
    }
    addProcessor() {
      return this;
    }
    addService() {
      return this;
    }
    wire() {
      return this;
    }
    build() {
      return this;
    }
    start = vi.fn();
    destroy = vi.fn();
  },
}));

function mockClass(props: Record<string, unknown>) {
  return class {
    constructor(..._args: unknown[]) {
      Object.assign(
        this,
        Object.fromEntries(
          Object.entries(props).map(([k, v]) => [
            k,
            typeof v === 'function' ? vi.fn(v as (...args: unknown[]) => unknown) : v,
          ]),
        ),
      );
    }
  };
}

vi.mock('../sources/readers/session-reader.js', () => ({
  SessionReader: mockClass({
    destroy() {},
    getSessions: () => [],
    attachSubAgents() {},
    setDb() {},
    invalidateTurnCounts() {},
  }),
}));
vi.mock('../sources/readers/cron-reader.js', () => ({ CronReader: mockClass({ destroy() {} }) }));
vi.mock('../platforms/index.js', () => ({
  loadPlatform: vi.fn(() =>
    Promise.resolve({
      os: 'darwin',
      process: {
        getPid: vi.fn(),
        getProcessMetrics: vi.fn(),
        getUptime: vi.fn(),
        findPidByPort: vi.fn(),
        getDiskMB: vi.fn(),
      },
      cli: { exec: vi.fn(() => Promise.resolve('')) },
    }),
  ),
}));
vi.mock('../sources/gateway-cli.js', () => ({
  createGatewayClient: vi.fn(() => ({ getGatewayStatus: vi.fn(), getVersion: vi.fn(), warmCache: vi.fn() })),
}));
vi.mock('../sources/system-info.js', () => ({
  createSystemInfoService: vi.fn(() => ({ getSystemMetrics: vi.fn(() => ({ cpu: 0, memoryMB: 0 })) })),
}));
vi.mock('../sources/collectors/log/tailer.js', () => ({ LogTailer: mockClass({ on() {}, destroy() {} }) }));
vi.mock('../sources/collectors/transcript/manager.js', () => ({
  createTranscriptManager: () => ({
    state: { kind: 'idle' },
    init: () => Promise.resolve(),
    destroy() {},
    getStats: () => Promise.resolve({}),
    getFileStates: () => new Map(),
    isReady: () => false,
  }),
}));
vi.mock('../sources/readers/spawn-tracker.js', () => ({ SpawnTracker: mockClass({ ingest() {} }) }));
vi.mock('../sources/aggregator.js', () => ({
  Aggregator: mockClass({ ingestLog() {}, getMetrics: () => ({ totalTokensK: 0 }) }),
}));
vi.mock('../sources/collectors/metrics/collector.js', () => ({ SystemSampler: mockClass({ start() {}, stop() {} }) }));
vi.mock('../sources/data-validator.js', () => ({ DataValidator: mockClass({ start() {}, stop() {} }) }));
vi.mock('../sources/data-retention.js', () => ({ DataRetention: mockClass({ start() {}, stop() {} }) }));
vi.mock('../db/token-queries.js', () => ({ insertTokenUsageEventBatch: vi.fn() }));
vi.mock('../db/message-queries.js', () => ({ insertMessageEventBatch: vi.fn() }));
vi.mock('../sources/collectors/log/ingester.js', () => ({ createLogIngester: vi.fn(() => ({ handle: vi.fn() })) }));

import type { AppContext } from '../context';
import { destroyContext, startContext } from '../context';

function mockCtx(overrides: Partial<AppContext> = {}): AppContext {
  return {
    db: { close: vi.fn() },
    pipeline: { start: vi.fn(), destroy: vi.fn() },
    lifetimeScanner: {
      state: { kind: 'idle' },
      init: vi.fn().mockResolvedValue(undefined),
      destroy: vi.fn(),
      getStats: vi.fn().mockResolvedValue({}),
      getFileStates: vi.fn(() => new Map()),
      isReady: vi.fn(() => false),
    },
    destroyed: false,
    tokenBus: { on: vi.fn(), emit: vi.fn(), destroy: vi.fn() },
    messageBus: { on: vi.fn(), emit: vi.fn(), destroy: vi.fn() },
    ...overrides,
  } as unknown as AppContext;
}

describe('startContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts pipeline and calls lifetimeScanner.init', async () => {
    const ctx = mockCtx();
    startContext(ctx);
    expect(ctx.pipeline.start).toHaveBeenCalledTimes(1);
    // Flush microtask queue for the .then()
    await vi.advanceTimersByTimeAsync(0);
    expect(ctx.lifetimeScanner.init).toHaveBeenCalledTimes(1);
  });

  it('handles lifetimeScanner.init rejection without throwing', async () => {
    mockLogError.mockClear();
    const initError = new Error('scanner fail');
    const ctx = mockCtx({
      lifetimeScanner: { init: vi.fn().mockRejectedValue(initError) } as any,
    });
    startContext(ctx);
    await vi.advanceTimersByTimeAsync(0);
    expect(mockLogError).toHaveBeenCalledTimes(1);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ err: initError }),
      'lifetime scanner init failed',
    );
  });
});

describe('destroyContext', () => {
  it('destroys pipeline and closes db', () => {
    const callOrder: string[] = [];
    const ctx = mockCtx({
      pipeline: {
        start: vi.fn(),
        destroy: vi.fn(() => {
          callOrder.push('destroy');
        }),
      },
      db: {
        close: vi.fn(() => {
          callOrder.push('close');
        }),
      },
    } as any);
    destroyContext(ctx);
    expect(ctx.pipeline.destroy).toHaveBeenCalledTimes(1);
    expect((ctx.db as any).close).toHaveBeenCalledTimes(1);
    expect(callOrder).toEqual(['destroy', 'close']);
  });

  it('calls db.close()', () => {
    const closeSpy = vi.fn();
    const ctx = mockCtx({ db: { close: closeSpy } as any });
    destroyContext(ctx);
    expect(closeSpy).toHaveBeenCalled();
  });
});

describe('createContext', () => {
  it('creates context with TranscriptManager as lifetimeScanner', async () => {
    const { createContext } = await import('../context');
    const ctx = await createContext();
    expect(ctx.lifetimeScanner).toBeDefined();
    expect(ctx.lifetimeScanner.init).toBeTypeOf('function');
    expect(ctx.lifetimeScanner.getStats).toBeTypeOf('function');
    expect(ctx.lifetimeScanner.isReady).toBeTypeOf('function');
  });
});
