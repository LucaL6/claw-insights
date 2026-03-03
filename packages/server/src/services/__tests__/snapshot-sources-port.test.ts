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

  it('getSessions() still calls attachSubAgents (legacy behavior preservation)', () => {
    const ctx = createMockContext();
    const sources = createSnapshotSources(ctx);

    sources.getSessions();

    // Verify attachSubAgents is still called (behavioral parity)
    expect(ctx.sessionReader.attachSubAgents).toHaveBeenCalledTimes(1);
    expect(ctx.sessionReader.attachSubAgents).toHaveBeenCalledWith(ctx.spawnTracker.getParentChildMap());
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
