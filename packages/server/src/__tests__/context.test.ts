import { beforeEach,describe, expect, it, vi } from 'vitest';

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
    addSource() { return this; }
    addManaged() { return this; }
    addProcessor() { return this; }
    addService() { return this; }
    wire() { return this; }
    build() { return this; }
    start = vi.fn();
    destroy = vi.fn();
    get() { return null; }
    getConfig() { return { sources: new Map(), managed: new Map(), processors: new Map(), services: new Map(), wiring: [] }; }
  },
}));

function mockClass(props: Record<string, unknown>) {
  return class { constructor(..._args: unknown[]) { Object.assign(this, Object.fromEntries(Object.entries(props).map(([k, v]) => [k, typeof v === 'function' ? vi.fn(v) : v]))); } };
}

vi.mock('../sources/readers/session-reader.js', () => ({
  SessionReader: mockClass({ destroy() {}, getSessions: () => [], attachSubAgents() {} }),
}));

vi.mock('../sources/readers/cron-reader.js', () => ({
  CronReader: mockClass({ destroy() {} }),
}));

vi.mock('../sources/system-info.js', () => ({
  getSystemMetrics: vi.fn(async () => ({ cpu: 10, memoryMB: 512, diskMB: 100, sampledAt: '' })),
  getUsageCost: vi.fn(async () => ({ totalCost: 0, totalTokensM: 0, todayCost: 0, todayTokensM: 0, fetchedAt: '' })),
}));

vi.mock('../sources/collectors/log-tailer.js', () => ({
  LogTailer: mockClass({ on() {}, off() {}, destroy() {} }),
}));

vi.mock('../sources/readers/spawn-tracker.js', () => ({
  SpawnTracker: mockClass({ ingest() {} }),
}));

vi.mock('../sources/aggregator.js', () => ({
  Aggregator: mockClass({ ingestLog() {}, getMetrics: () => ({ totalTokensK: 100 }) }),
}));

vi.mock('../sources/collectors/metrics-collector.js', () => ({
  MetricsCollector: mockClass({ start() {}, stop() {} }),
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
    const ctx = createContext();

    expect(ctx.db).toBeDefined();
    expect(ctx.pipeline).toBeDefined();
    expect(ctx.sessionReader).toBeDefined();
    expect(ctx.cronReader).toBeDefined();
    expect(ctx.logTailer).toBeDefined();
    expect(ctx.spawnTracker).toBeDefined();
    expect(ctx.aggregator).toBeDefined();
    expect(ctx.metricsCollector).toBeDefined();
    expect(ctx.dataValidator).toBeDefined();
    expect(ctx.dataRetention).toBeDefined();
  });

  it('createContext builds pipeline with declarative wiring', async () => {
    const { createContext } = await import('../context');
    const ctx = createContext();

    // Pipeline was built (returned from .build())
    expect(ctx.pipeline).toBeDefined();
  });

  it('startContext starts pipeline', async () => {
    const { createContext, startContext } = await import('../context');
    const ctx = createContext();
    startContext(ctx);

    expect(ctx.pipeline.start).toHaveBeenCalled();
  });

  it('destroyContext cleans up via pipeline and closes db', async () => {
    const { createContext, destroyContext } = await import('../context');
    const ctx = createContext();
    destroyContext(ctx);

    expect(ctx.pipeline.destroy).toHaveBeenCalled();
    expect(((ctx.db as unknown as Record<string, unknown>)).close).toHaveBeenCalled();
  });

  it('destroyContext handles db without close method', async () => {
    const { createContext, destroyContext } = await import('../context');
    const ctx = createContext();
    // Remove close method to test the typeof check
    delete ((ctx.db as unknown as Record<string, unknown>)).close;
    // Should not throw
    destroyContext(ctx);
  });
});
