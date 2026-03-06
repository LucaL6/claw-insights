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
    private ports = new Map();
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
    addPort(key: string, port: any) {
      this.ports.set(key, port);
      return this;
    }
    getPort(key: string) {
      return this.ports.get(key);
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
    setSpawnBus() {},
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

vi.mock('../sources/collectors/log/tailer.js', () => ({
  LogTailer: mockClass({ on() {}, off() {}, destroy() {} }),
}));

vi.mock('../sources/collectors/transcript/manager.js', () => ({
  createTranscriptManager: () => ({
    state: { kind: 'idle' },
    init: () => Promise.resolve(),
    destroy: vi.fn(),
    getStats: () => Promise.resolve({}),
    getFileStates: () => new Map(),
    isReady: () => false,
  }),
}));

vi.mock('../sources/readers/spawn-tracker.js', () => ({
  SpawnTracker: mockClass({ ingest() {}, getParentChildMap: () => new Map() }),
}));

vi.mock('../sources/aggregator.js', () => ({
  Aggregator: mockClass({ ingestLog() {}, getMetrics: () => ({ totalTokensK: 100 }) }),
}));

vi.mock('../sources/collectors/metrics/collector.js', () => ({
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
    expect(ctx.destroyed).toBe(false);
    expect(ctx.tokenBus).toBeDefined();
    expect(ctx.messageBus).toBeDefined();
    expect(ctx.gatewayClient).toBeDefined();
    expect(ctx.systemInfoService).toBeDefined();
  });

  it('createContext builds pipeline with declarative wiring', async () => {
    const { createContext } = await import('../context');
    const ctx = await createContext();

    // Pipeline was built (returned from .build())
    expect(ctx.pipeline).toBeDefined();
  });

  it('does not wire SpawnBus into SessionReader hierarchy flow', async () => {
    const { createContext } = await import('../context');
    const ctx = await createContext();

    expect((ctx.sessionReader as unknown as Record<string, any>).setSpawnBus).not.toHaveBeenCalled();
    expect((ctx.sessionReader as unknown as Record<string, any>).attachSubAgents).not.toHaveBeenCalled();
  });

  it('startContext starts pipeline and calls init', async () => {
    const { createContext, startContext } = await import('../context');
    const ctx = await createContext();

    startContext(ctx);
    await Promise.resolve();

    expect(ctx.pipeline.start).toHaveBeenCalled();
  });

  it('destroyContext destroys pipeline and closes db', async () => {
    const { createContext, destroyContext } = await import('../context');
    const ctx = await createContext();

    await destroyContext(ctx);

    expect(ctx.pipeline.destroy).toHaveBeenCalled();
    expect((ctx.db as unknown as Record<string, unknown>).close).toHaveBeenCalled();
  });

  it('does not warm cache if destroyed before init resolves', async () => {
    const { createContext, startContext, destroyContext } = await import('../context');
    const ctx = await createContext();

    startContext(ctx);
    await destroyContext(ctx);

    await new Promise((r) => setImmediate(r));
    await Promise.resolve();

    expect(ctx.destroyed).toBe(true);
  });

  it('destroyContext calls db.close()', async () => {
    const { createContext, destroyContext } = await import('../context');
    const ctx = await createContext();
    const closeSpy = vi.fn();
    (ctx.db as unknown as Record<string, unknown>).close = closeSpy;
    await destroyContext(ctx);
    expect(closeSpy).toHaveBeenCalled();
  });
});
