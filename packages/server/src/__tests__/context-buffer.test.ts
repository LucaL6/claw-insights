import { describe, expect, it, vi } from 'vitest';

// Capture event bus callbacks
const tokenBusCallbacks: Array<(event: unknown) => void> = [];
const messageBusCallbacks: Array<(event: unknown) => void> = [];
let lifetimeScannerResetFn: (() => void) | undefined;

const mockInsertTokenBatch = vi.fn();
const mockInsertMessageBatch = vi.fn();
const mockDeleteAllMessages = vi.fn();
const mockInvalidateTurnCounts = vi.fn();

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
        Object.fromEntries(Object.entries(props).map(([k, v]) => [k, typeof v === 'function' ? vi.fn(v) : v])),
      );
    }
  };
}

vi.mock('../events/token-event-bus.js', () => ({
  TokenEventBus: class {
    on(cb: (event: unknown) => void) {
      tokenBusCallbacks.push(cb);
    }
    destroy() {}
  },
}));

vi.mock('../events/message-event-bus.js', () => ({
  MessageEventBus: class {
    on(cb: (event: unknown) => void) {
      messageBusCallbacks.push(cb);
    }
    destroy() {}
  },
}));

vi.mock('../sources/readers/session-reader.js', () => ({
  SessionReader: class {
    destroy() {}
    getSessions() {
      return [];
    }
    attachSubAgents() {}
    setDb() {}
    invalidateTurnCounts = mockInvalidateTurnCounts;
  },
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
vi.mock('../sources/collectors/log-tailer.js', () => ({ LogTailer: mockClass({ on() {}, destroy() {} }) }));
vi.mock('../sources/collectors/lifetime-scanner.js', () => ({
  LifetimeScanner: class {
    constructor(_td: string, _dp: string, _tb: unknown, _mb: unknown, resetFn: () => void) {
      lifetimeScannerResetFn = resetFn;
    }
    init() {
      return Promise.resolve();
    }
    destroy() {}
  },
}));
vi.mock('../sources/readers/spawn-tracker.js', () => ({ SpawnTracker: mockClass({ ingest() {} }) }));
vi.mock('../sources/aggregator.js', () => ({
  Aggregator: mockClass({ getMetrics: () => ({ totalTokensK: 0 }), clearCache() {} }),
}));
vi.mock('../sources/collectors/metrics-collector.js', () => ({ SystemSampler: mockClass({ start() {}, stop() {} }) }));
vi.mock('../sources/data-validator.js', () => ({ DataValidator: mockClass({ start() {}, stop() {} }) }));
vi.mock('../sources/data-retention.js', () => ({ DataRetention: mockClass({ start() {}, stop() {} }) }));
vi.mock('../db/token-queries.js', () => ({ insertTokenUsageEventBatch: mockInsertTokenBatch }));
vi.mock('../db/message-queries.js', () => ({
  insertMessageEventBatch: mockInsertMessageBatch,
  deleteAllMessageEvents: mockDeleteAllMessages,
}));
vi.mock('../sources/collectors/log-ingester.js', () => ({ createLogIngester: vi.fn(() => ({ handle: vi.fn() })) }));

describe('context buffer and event bus branches', () => {
  it('flushTokenEvents flushes non-empty buffer', async () => {
    tokenBusCallbacks.length = 0;
    const { createContext } = await import('../context.js');
    const ctx = await createContext();

    // Push one event via the token bus callback
    expect(tokenBusCallbacks.length).toBeGreaterThan(0);
    tokenBusCallbacks[0]({
      timestamp: 't',
      sessionKey: 's',
      model: 'm',
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
    });

    // Now flush should call insertTokenUsageEventBatch
    ctx.flushTokenEvents();
    expect(mockInsertTokenBatch).toHaveBeenCalledWith(
      expect.anything(),
      expect.arrayContaining([expect.objectContaining({ sessionKey: 's' })]),
    );
  });

  it('token bus auto-flushes at BATCH_SIZE (100)', async () => {
    tokenBusCallbacks.length = 0;
    mockInsertTokenBatch.mockClear();
    const { createContext } = await import('../context.js');
    await createContext();

    const cb = tokenBusCallbacks[tokenBusCallbacks.length - 1];
    for (let i = 0; i < 100; i++) {
      cb({
        timestamp: `t${i}`,
        sessionKey: 's',
        model: 'm',
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
      });
    }
    expect(mockInsertTokenBatch).toHaveBeenCalled();
  });

  it('flushMessageEvents flushes non-empty buffer and invalidates turn counts', async () => {
    messageBusCallbacks.length = 0;
    mockInsertMessageBatch.mockClear();
    mockInvalidateTurnCounts.mockClear();
    const { createContext } = await import('../context.js');
    const ctx = await createContext();

    const cb = messageBusCallbacks[messageBusCallbacks.length - 1];
    cb({ timestamp: 't', sessionKey: 's', role: 'user' });

    ctx.flushMessageEvents();
    expect(mockInsertMessageBatch).toHaveBeenCalled();
    expect(mockInvalidateTurnCounts).toHaveBeenCalled();
  });

  it('message bus auto-flushes at BATCH_SIZE (100)', async () => {
    messageBusCallbacks.length = 0;
    mockInsertMessageBatch.mockClear();
    const { createContext } = await import('../context.js');
    await createContext();

    const cb = messageBusCallbacks[messageBusCallbacks.length - 1];
    for (let i = 0; i < 100; i++) {
      cb({ timestamp: `t${i}`, sessionKey: 's', role: 'user' });
    }
    expect(mockInsertMessageBatch).toHaveBeenCalled();
  });

  it('lifetimeScanner reset callback clears message events and buffer', async () => {
    lifetimeScannerResetFn = undefined;
    mockDeleteAllMessages.mockClear();
    const { createContext } = await import('../context.js');
    await createContext();

    expect(lifetimeScannerResetFn).toBeDefined();
    lifetimeScannerResetFn!();
    expect(mockDeleteAllMessages).toHaveBeenCalled();
  });
});
