import { describe, it, expect, vi, beforeEach } from 'vitest';

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

function mockClass(props: Record<string, any>) {
  return class { constructor(..._args: any[]) { Object.assign(this, Object.fromEntries(Object.entries(props).map(([k, v]) => [k, typeof v === 'function' ? vi.fn(v) : v]))); } };
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

// usage-cost mock merged into system-info.js above

describe('context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createContext returns all expected properties', async () => {
    const { createContext } = await import('../context');
    const ctx = createContext();

    expect(ctx.db).toBeDefined();
    expect(ctx.sessionReader).toBeDefined();
    expect(ctx.cronReader).toBeDefined();
    // systemMetrics is now a standalone function (getSystemMetrics), not a context property
    expect(ctx.logTailer).toBeDefined();
    expect(ctx.spawnTracker).toBeDefined();
    expect(ctx.aggregator).toBeDefined();
    expect(ctx.metricsCollector).toBeDefined();
    expect(ctx.dataValidator).toBeDefined();
    expect(ctx.dataRetention).toBeDefined();
  });

  it('createContext wires log events to aggregator and spawn tracker', async () => {
    const { createContext } = await import('../context');
    const ctx = createContext();

    // LogTailer.on should have been called with 'log'
    expect(ctx.logTailer.on).toHaveBeenCalledWith('log', expect.any(Function));
  });

  it('startContext starts collectors', async () => {
    const { createContext, startContext } = await import('../context');
    const ctx = createContext();
    startContext(ctx);

    expect(ctx.metricsCollector.start).toHaveBeenCalled();
    expect(ctx.dataValidator.start).toHaveBeenCalled();
    expect(ctx.dataRetention.start).toHaveBeenCalled();
  });

  it('destroyContext cleans up all resources', async () => {
    const { createContext, destroyContext } = await import('../context');
    const ctx = createContext();
    destroyContext(ctx);

    expect(ctx.sessionReader.destroy).toHaveBeenCalled();
    expect(ctx.logTailer.destroy).toHaveBeenCalled();
    expect(ctx.cronReader.destroy).toHaveBeenCalled();
    expect(ctx.metricsCollector.stop).toHaveBeenCalled();
    expect(ctx.dataValidator.stop).toHaveBeenCalled();
    expect(ctx.dataRetention.stop).toHaveBeenCalled();
    expect((ctx.db as any).close).toHaveBeenCalled();
  });

  it('destroyContext handles db without close method', async () => {
    const { createContext, destroyContext } = await import('../context');
    const ctx = createContext();
    // Remove close method to test the typeof check
    delete (ctx.db as any).close;
    // Should not throw
    destroyContext(ctx);
  });
});
