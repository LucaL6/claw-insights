import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DashboardConnection } from '../useConnectionStatus';

let mockConnection: DashboardConnection = 'connected';
const mockReexecuteGateway = vi.fn();

const queryResults: Record<string, [unknown, ...unknown[]]> = {};

vi.mock('../../graphql/queries', () => ({
  GatewayQuery: 'GatewayQuery',
  ResourcesQuery: 'ResourcesQuery',
  ChannelsQuery: 'ChannelsQuery',
}));

vi.mock('../../utils/format', () => ({
  formatUptime: (v: string | undefined) => (v ? 'some uptime' : ''),
}));

vi.mock('../useReactiveQuery', () => ({
  useReactiveQuery: (opts: { query: unknown }) => {
    const key = String(opts.query).slice(0, 40);
    for (const [k, v] of Object.entries(queryResults)) {
      if (key.includes(k)) {
        // Gateway query returns [data, reexecute]
        if (k === 'Gateway') {return [v[0], mockReexecuteGateway];}
        return v;
      }
    }
    return [{ data: undefined, fetching: false }];
  },
}));

vi.mock('../useConnectionStatus', () => ({
  useConnectionStatus: () => mockConnection,
}));

import { useGatewayData } from '../useGatewayData';

function setDefaultQueryResults() {
  queryResults['Gateway'] = [
    { data: { gateway: { running: true, startedAt: '2025-02-22T00:00:00Z' } }, fetching: false },
  ];
  queryResults['Resources'] = [{ data: { resources: { cpu: 2.1, memoryMB: 85 } }, fetching: false }];
  queryResults['Channels'] = [
    {
      data: { channels: [{ provider: 'telegram', name: 'Telegram', connected: true, latencyMs: 12 }] },
      fetching: false,
    },
  ];
}

describe('useGatewayData', () => {
  beforeEach(() => {
    mockConnection = 'connected';
    mockReexecuteGateway.mockReset();
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns status=running when gateway.running is true', () => {
    setDefaultQueryResults();

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('running');
    expect(result.current.resources).toEqual({ cpu: 2.1, memoryMB: 85 });
    expect(result.current.channels).toHaveLength(1);
    expect(result.current.uptime).toBeDefined();
  });

  it('returns status=gateway-down when gateway.running is false', () => {
    queryResults['Gateway'] = [{ data: { gateway: { running: false } }, fetching: false }];
    queryResults['Resources'] = [{ data: undefined, fetching: false }];
    queryResults['Channels'] = [{ data: { channels: [] }, fetching: false }];

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('gateway-down');
  });

  it('returns status=connecting when gateway is fetching with no data', () => {
    queryResults['Gateway'] = [{ data: undefined, fetching: true }];
    queryResults['Resources'] = [{ data: undefined, fetching: true }];
    queryResults['Channels'] = [{ data: undefined, fetching: true }];

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('connecting');
  });

  it('returns status=gateway-down when fetch completes with no data (error case)', () => {
    queryResults['Gateway'] = [{ data: undefined, fetching: false }];
    queryResults['Resources'] = [{ data: undefined, fetching: false }];
    queryResults['Channels'] = [{ data: undefined, fetching: false }];

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('gateway-down');
    expect(result.current.channels).toEqual([]);
  });

  // --- Priority tests ---

  it('connecting takes priority when useConnectionStatus returns connecting', () => {
    mockConnection = 'connecting';
    setDefaultQueryResults();

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('connecting');
  });

  it('dashboard-offline when useConnectionStatus returns reconnecting', () => {
    mockConnection = 'reconnecting';
    setDefaultQueryResults();

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('dashboard-offline');
  });

  it('gateway-down when connected but gateway not running', () => {
    mockConnection = 'connected';
    queryResults['Gateway'] = [{ data: { gateway: { running: false } }, fetching: false }];
    queryResults['Resources'] = [{ data: undefined, fetching: false }];
    queryResults['Channels'] = [{ data: { channels: [] }, fetching: false }];

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('gateway-down');
  });

  it('connecting takes priority over gateway-down', () => {
    mockConnection = 'connecting';
    queryResults['Gateway'] = [{ data: { gateway: { running: false } }, fetching: false }];
    queryResults['Resources'] = [{ data: undefined, fetching: false }];
    queryResults['Channels'] = [{ data: { channels: [] }, fetching: false }];

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('connecting');
  });

  it('dashboard-offline takes priority over gateway-down', () => {
    mockConnection = 'reconnecting';
    queryResults['Gateway'] = [{ data: { gateway: { running: false } }, fetching: false }];
    queryResults['Resources'] = [{ data: undefined, fetching: false }];
    queryResults['Channels'] = [{ data: { channels: [] }, fetching: false }];

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('dashboard-offline');
  });

  // --- Retry + visibility gate tests ---

  it('schedules retry when gateway-down and calls reexecute after delay', () => {
    queryResults['Gateway'] = [{ data: { gateway: { running: false } }, fetching: false }];
    queryResults['Resources'] = [{ data: undefined, fetching: false }];
    queryResults['Channels'] = [{ data: { channels: [] }, fetching: false }];

    renderHook(() => useGatewayData());
    expect(mockReexecuteGateway).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(mockReexecuteGateway).toHaveBeenCalledWith({ requestPolicy: 'network-only' });
  });

  // Visibility gating and retry reset tests moved to useRetryWithBackoff.test.ts
});
