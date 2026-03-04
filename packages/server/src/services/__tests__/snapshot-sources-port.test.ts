// Task 7: snapshot-sources port migration tests
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ReadContext } from '../../ports/shared.js';
import { createSnapshotSources } from '../snapshot-sources.js';

vi.mock('../../db/message-queries.js');
vi.mock('../../db/token-queries.js');
vi.mock('../../db/event-queries.js');
vi.mock('../../db/system-queries.js');
vi.mock('../../sources/companion-days.js');
vi.mock('../../sources/gateway-cli.js');
vi.mock('../../sources/system-info.js');
vi.mock('../../config.js', () => ({
  config: { deviceJsonPath: '/fake/device.json', openclawDir: '/fake/.openclaw' },
}));

describe('Task 7: snapshot-sources getSessions() port migration', () => {
  const mockSession = {
    id: 'test-session-1',
    name: 'Test Session',
    created: '2026-01-01T00:00:00Z',
    updated: '2026-01-01T01:00:00Z',
    status: 'active' as const,
  };

  function createMockContext() {
    const mockSessionPort = {
      getSessions: vi.fn(() => [mockSession]),
      getSessionById: vi.fn(),
      getSessionsInRange: vi.fn(),
      getSessionCount: vi.fn(),
      getSessionIdToKeyMap: vi.fn(() => new Map()),
      onChanged: vi.fn(() => () => {}),
    };

    const mockMetricsPort = {
      getMetrics: vi.fn(() => ({})),
      onChanged: vi.fn(() => () => {}),
    };

    const mockGatewayPort = {
      getGatewayStatus: vi.fn(() => Promise.resolve({ channels: [] })),
      getVersion: vi.fn(),
      warmCache: vi.fn(),
      onChanged: vi.fn(() => () => {}),
    };

    return {
      ports: {
        sessions: mockSessionPort,
        metrics: mockMetricsPort,
        gateway: mockGatewayPort,
        cron: undefined,
        logs: undefined,
        system: undefined,
      },
      db: {},
      sessionReader: {
        getSessionIdToKeyMap: () => new Map(),
        attachSubAgents: vi.fn(),
        getSessions: vi.fn(() => [mockSession]),
      },
      spawnTracker: {
        getParentChildMap: () => new Map(),
      },
      aggregator: {
        getMetrics: vi.fn(() => ({})),
      },
      gatewayClient: {
        getGatewayStatus: vi.fn(() => Promise.resolve({ channels: [] })),
      },
      systemInfoService: {
        getSystemMetrics: vi.fn(() => Promise.resolve({ cpu: 0, memoryMB: 0 })),
      },
    } as any;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getSessions() reads from ctx.ports.sessions instead of legacy sessionReader', () => {
    const ctx = createMockContext();
    const sources = createSnapshotSources(ctx);

    const result = sources.getSessions();

    // Should call ctx.ports.sessions.getSessions()
    expect(ctx.ports.sessions.getSessions).toHaveBeenCalledTimes(1);
    expect(result).toEqual([mockSession]);

    // Should NOT call legacy ctx.sessionReader.getSessions()
    expect(ctx.sessionReader.getSessions).not.toHaveBeenCalled();
  });

  it('getSessions() passes ReadContext to port', () => {
    const ctx = createMockContext();
    const sources = createSnapshotSources(ctx);

    sources.getSessions();

    // Verify port was called with a ReadContext argument
    const portCall = vi.mocked(ctx.ports.sessions.getSessions).mock.calls[0];
    expect(portCall).toBeDefined();

    // Second argument should be ReadContext
    const readContext = portCall[1] as ReadContext | undefined;
    expect(readContext).toBeDefined();
    expect(readContext).toHaveProperty('requestId');
    expect(readContext).toHaveProperty('asOfTs');
    expect(typeof readContext!.requestId).toBe('string');
    expect(typeof readContext!.asOfTs).toBe('number');
  });

  it('getSessions() ReadContext.asOfTs is a plain field, not a getter', () => {
    const ctx = createMockContext();
    const sources = createSnapshotSources(ctx);

    sources.getSessions();

    const portCall = vi.mocked(ctx.ports.sessions.getSessions).mock.calls[0];
    const readContext = portCall[1] as ReadContext;

    // Verify asOfTs is a plain data field, not a getter
    const descriptor = Object.getOwnPropertyDescriptor(readContext, 'asOfTs');
    expect(descriptor).toBeDefined();
    expect(descriptor!.get).toBeUndefined();
    expect(descriptor!.value).toBeDefined();
    expect(typeof descriptor!.value).toBe('number');
  });

  it('getSessions() reuses same ReadContext for single call (no cross-port test needed here)', () => {
    const ctx = createMockContext();
    const sources = createSnapshotSources(ctx);

    sources.getSessions();

    // getSessions only calls one port, so just verify it was called with a ReadContext
    expect(ctx.ports.sessions.getSessions).toHaveBeenCalledTimes(1);
    const readContext = vi.mocked(ctx.ports.sessions.getSessions).mock.calls[0][1];
    expect(readContext).toBeDefined();
    expect(readContext).toHaveProperty('requestId');
  });

  it('getSessions() uses port without calling attachSubAgents (DESIGN-066 event-driven)', () => {
    const ctx = createMockContext();
    const sources = createSnapshotSources(ctx);

    sources.getSessions();

    // attachSubAgents no longer called here - handled by SpawnBus event system
    expect(ctx.sessionReader.attachSubAgents).not.toHaveBeenCalled();
  });

  it('getSessions() returns data from port, not from legacy reader', () => {
    const ctx = createMockContext();

    // Set up different return values to verify which is used
    const portSession = { id: 'port-session', name: 'From Port' } as any;
    const legacySession = { id: 'legacy-session', name: 'From Legacy' } as any;

    vi.mocked(ctx.ports.sessions.getSessions).mockReturnValue([portSession]);
    vi.mocked(ctx.sessionReader.getSessions).mockReturnValue([legacySession]);

    const sources = createSnapshotSources(ctx);
    const result = sources.getSessions();

    // Should return port data, not legacy data
    expect(result).toEqual([portSession]);
    expect(result).not.toEqual([legacySession]);
  });
});

describe('Phase 2: snapshot-sources getGateway() system metrics port migration', () => {
  function createMockContext() {
    const mockSystemPort = {
      getSystemMetrics: vi.fn(() =>
        Promise.resolve({
          cpu: 42,
          memoryMB: 1024,
          diskMB: 2048,
          uptime: '3600s',
          platform: 'darwin',
          nodeVersion: 'v20.0.0',
        }),
      ),
      getProcessMetrics: vi.fn(),
    };

    const mockGatewayPort = {
      getGatewayStatus: vi.fn(() =>
        Promise.resolve({
          running: true,
          pid: 1234,
          version: '1.0.0',
          channels: [],
        }),
      ),
      getVersion: vi.fn(),
      warmCache: vi.fn(),
    };

    return {
      ports: {
        sessions: {
          getSessions: vi.fn(() => []),
          getSessionById: vi.fn(),
          getSessionsInRange: vi.fn(),
          getSessionCount: vi.fn(),
          getSessionIdToKeyMap: vi.fn(() => new Map()),
          onChanged: vi.fn(() => () => {}),
        },
        metrics: {
          getMetrics: vi.fn(() => ({})),
          onChanged: vi.fn(() => () => {}),
        },
        gateway: mockGatewayPort,
        cron: undefined,
        logs: undefined,
        system: mockSystemPort,
      },
      db: {},
      sessionReader: {
        getSessionIdToKeyMap: () => new Map(),
        attachSubAgents: vi.fn(),
        getSessions: vi.fn(() => []),
      },
      spawnTracker: {
        getParentChildMap: () => new Map(),
      },
      aggregator: {
        getMetrics: vi.fn(() => ({})),
      },
      gatewayClient: {
        getGatewayStatus: vi.fn(() => Promise.resolve({ channels: [] })),
      },
      systemInfoService: {
        getSystemMetrics: vi.fn(() => Promise.resolve({ cpu: 99, memoryMB: 9999 })),
      },
    } as any;
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getGateway() reads system metrics from ctx.ports.system instead of legacy systemInfoService', async () => {
    const ctx = createMockContext();
    const sources = createSnapshotSources(ctx);

    const result = await sources.getGateway();

    // Should call ctx.ports.system.getSystemMetrics()
    expect(ctx.ports.system.getSystemMetrics).toHaveBeenCalledTimes(1);

    // Should NOT call legacy ctx.systemInfoService.getSystemMetrics()
    expect(ctx.systemInfoService.getSystemMetrics).not.toHaveBeenCalled();

    // Result should have system metrics from port
    expect(result.cpu).toBe(42);
    expect(result.memoryMB).toBe(1024);
  });

  it('getGateway() passes ReadContext to system port', async () => {
    const ctx = createMockContext();
    const sources = createSnapshotSources(ctx);

    await sources.getGateway();

    // Verify port was called with a ReadContext argument
    const portCall = vi.mocked(ctx.ports.system.getSystemMetrics).mock.calls[0];
    expect(portCall).toBeDefined();

    // First argument should be ReadContext
    const readContext = portCall[0] as ReadContext | undefined;
    expect(readContext).toBeDefined();
    expect(readContext).toHaveProperty('requestId');
    expect(readContext).toHaveProperty('asOfTs');
    expect(typeof readContext!.requestId).toBe('string');
    expect(typeof readContext!.asOfTs).toBe('number');
  });

  it('getGateway() returns merged data from gateway and system ports', async () => {
    const ctx = createMockContext();
    const sources = createSnapshotSources(ctx);

    const result = await sources.getGateway();

    // Should have gateway data
    expect(result.running).toBe(true);
    expect(result.pid).toBe(1234);
    expect(result.version).toBe('1.0.0');

    // Should have system metrics data
    expect(result.cpu).toBe(42);
    expect(result.memoryMB).toBe(1024);
  });
});
