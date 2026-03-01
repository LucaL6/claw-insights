import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock all dependencies before importing
vi.mock('../config.js', () => ({
  config: {
    dbPath: ':memory:',
    sessionsPath: '/tmp/test-sessions',
    cronPath: '/tmp/test-cron',
    logDir: '/tmp/test-logs',
    rawRetentionDays: 7,
    hourlyRetention: 30,
    aggregateIntervalMs: 60000,
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
    get() {
      return null;
    }
    getConfig() {
      return { sources: new Map(), managed: new Map(), processors: new Map(), services: new Map(), wiring: [] };
    }
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

vi.mock('../sources/readers/cron-reader.js', () => ({
  CronReader: mockClass({ destroy() {} }),
}));

vi.mock('../platforms/index.js', () => ({
  loadPlatform: vi.fn(() =>
    Promise.resolve({
      os: 'darwin',
      process: {
        getPid: vi.fn(() => Promise.resolve(null)),
        getProcessMetrics: vi.fn(() => Promise.resolve(null)),
        getUptime: vi.fn(() => Promise.resolve(null)),
        findPidByPort: vi.fn(() => Promise.resolve(null)),
        getDiskMB: vi.fn(() => Promise.resolve(null)),
      },
      cli: { exec: vi.fn(() => Promise.resolve('')) },
    }),
  ),
}));

vi.mock('../sources/gateway-cli.js', () => ({
  createGatewayClient: vi.fn(() => ({
    getGatewayStatus: vi.fn(() => Promise.resolve({ running: false })),
    getVersion: vi.fn(() => Promise.resolve('0.0.0')),
    warmCache: vi.fn(() => Promise.resolve()),
  })),
}));

vi.mock('../sources/system-info.js', () => ({
  createSystemInfoService: vi.fn(() => ({
    getSystemMetrics: vi.fn(() => Promise.resolve({ cpu: 10, memoryMB: 512, diskMB: 100, sampledAt: '' })),
    getUsageCost: vi.fn(() =>
      Promise.resolve({ totalCost: 0, totalTokensM: 0, todayCost: 0, todayTokensM: 0, fetchedAt: '' }),
    ),
    resetMetricsCache: vi.fn(),
    resetCostCache: vi.fn(),
  })),
}));

vi.mock('../sources/collectors/log-tailer.js', () => ({
  LogTailer: mockClass({ on() {}, off() {}, destroy() {} }),
}));

vi.mock('../sources/collectors/lifetime-scanner.js', () => ({
  createLifetimeScanner: () => ({
    init: () => Promise.resolve(),
    destroy() {},
    getStats: () => ({}),
    getFileStates: () => new Map(),
    isReady: () => false,
  }),
}));

vi.mock('../sources/collectors/transcript-watcher.js', () => {
  const mockWatcher = { destroy: vi.fn() };
  const mockBuilder = {
    pollEvery: vi.fn().mockReturnThis(),
    dirScanEvery: vi.fn().mockReturnThis(),
    byteBudget: vi.fn().mockReturnThis(),
    emitTo: vi.fn().mockReturnThis(),
    onFlush: vi.fn().mockReturnThis(),
    start: vi.fn(() => mockWatcher),
  };
  return {
    createTranscriptWatcher: vi.fn(() => mockBuilder),
    __mockBuilder: mockBuilder,
    __mockWatcher: mockWatcher,
  };
});

vi.mock('../sources/readers/spawn-tracker.js', () => ({
  SpawnTracker: mockClass({ ingest() {} }),
}));

vi.mock('../sources/aggregator.js', () => ({
  Aggregator: mockClass({ ingestLog() {}, getMetrics: () => ({ totalTokensK: 100 }) }),
}));

vi.mock('../sources/collectors/metrics-collector.js', () => ({
  SystemSampler: mockClass({ start() {}, stop() {} }),
}));

vi.mock('../sources/data-validator.js', () => ({
  DataValidator: mockClass({ start() {}, stop() {} }),
}));

vi.mock('../sources/data-retention.js', () => ({
  DataRetention: mockClass({ start() {}, stop() {} }),
}));

describe('context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createContext returns all expected properties', async () => {
    const { createContext } = await import('../context');
    const ctx = await createContext();

    expect(ctx.db).toBeDefined();
    expect(ctx.pipeline).toBeDefined();
    expect(ctx.sessionReader).toBeDefined();
    expect(ctx.cronReader).toBeDefined();
    expect(ctx.logTailer).toBeDefined();
    expect(ctx.spawnTracker).toBeDefined();
    expect(ctx.aggregator).toBeDefined();
    expect(ctx.systemSampler).toBeDefined();
    expect(ctx.dataValidator).toBeDefined();
    expect(ctx.dataRetention).toBeDefined();
    expect(ctx.transcriptWatcher).toBeNull();
    expect(ctx.destroyed).toBe(false);
    expect(ctx.tokenBus).toBeDefined();
    expect(ctx.messageBus).toBeDefined();
    expect(ctx.flushTokenEvents).toBeTypeOf('function');
    expect(ctx.flushMessageEvents).toBeTypeOf('function');
    expect(ctx.gatewayClient).toBeDefined();
    expect(ctx.systemInfoService).toBeDefined();
  });

  it('createContext builds pipeline with declarative wiring', async () => {
    const { createContext } = await import('../context');
    const ctx = await createContext();

    // Pipeline was built (returned from .build())
    expect(ctx.pipeline).toBeDefined();
  });

  it('startContext starts pipeline and flushes buffered events after init', async () => {
    const { createContext, startContext } = await import('../context');
    const ctx = await createContext();
    const flushTokenSpy = vi.spyOn(ctx, 'flushTokenEvents');
    const flushMessageSpy = vi.spyOn(ctx, 'flushMessageEvents');

    startContext(ctx);
    await Promise.resolve();

    expect(ctx.pipeline.start).toHaveBeenCalled();
    expect(flushTokenSpy).toHaveBeenCalled();
    expect(flushMessageSpy).toHaveBeenCalled();
  });

  it('destroyContext flushes buffers, destroys pipeline, and closes db', async () => {
    const { createContext, destroyContext } = await import('../context');
    const ctx = await createContext();
    const flushTokenSpy = vi.spyOn(ctx, 'flushTokenEvents');
    const flushMessageSpy = vi.spyOn(ctx, 'flushMessageEvents');

    destroyContext(ctx);

    expect(flushTokenSpy).toHaveBeenCalled();
    expect(flushMessageSpy).toHaveBeenCalled();
    expect(ctx.pipeline.destroy).toHaveBeenCalled();
    expect((ctx.db as unknown as Record<string, unknown>).close).toHaveBeenCalled();
  });

  it('startContext creates TranscriptWatcher after scanner init', async () => {
    const { createContext, startContext } = await import('../context');
    const { createTranscriptWatcher } = await import('../sources/collectors/transcript-watcher');
    const ctx = await createContext();

    startContext(ctx);
    // Wait for init() promise to resolve
    await new Promise((r) => setImmediate(r));
    await Promise.resolve();

    expect(createTranscriptWatcher).toHaveBeenCalled();
    expect(ctx.transcriptWatcher).toBeDefined();
    expect(ctx.transcriptWatcher).not.toBeNull();
  });

  it('destroyContext destroys TranscriptWatcher', async () => {
    const { createContext, startContext, destroyContext } = await import('../context');
    const ctx = await createContext();

    startContext(ctx);
    await new Promise((r) => setImmediate(r));
    await Promise.resolve();

    const watcher = ctx.transcriptWatcher;
    expect(watcher).not.toBeNull();

    destroyContext(ctx);
    expect(watcher!.destroy).toHaveBeenCalled();
  });

  it('does not create TranscriptWatcher if destroyed before init resolves', async () => {
    const { createContext, startContext, destroyContext } = await import('../context');
    const ctx = await createContext();

    startContext(ctx);
    destroyContext(ctx);

    await new Promise((r) => setImmediate(r));
    await Promise.resolve();

    expect(ctx.transcriptWatcher).toBeNull();
    expect(ctx.destroyed).toBe(true);
  });

  it('destroyContext handles db without close method', async () => {
    const { createContext, destroyContext } = await import('../context');
    const ctx = await createContext();
    // Remove close method to test the typeof check
    delete (ctx.db as unknown as Record<string, unknown>).close;
    // Should not throw
    destroyContext(ctx);
  });
});
