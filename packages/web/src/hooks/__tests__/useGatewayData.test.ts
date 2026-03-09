import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DashboardConnection } from '../useConnectionStatus';

let mockConnection: DashboardConnection = 'connected';
const mockReexecuteSystem = vi.fn();

const queryResults: Record<string, [unknown, ...unknown[]]> = {};
const useReactiveQueryMock = vi.fn();

type QueryCallOptions = {
  query?: string;
  pause?: boolean;
  variables?: { context?: { trace?: { requestId?: string } } };
};

const toQueryCallOptions = (call: unknown[]): QueryCallOptions | null => {
  const [firstArg] = call;
  if (!firstArg || typeof firstArg !== 'object') {
    return null;
  }

  return firstArg as QueryCallOptions;
};

vi.mock('../../graphql/queries', () => ({
  SystemDashboardQuery: 'SystemDashboardQuery',
}));

vi.mock('../../utils/format', () => ({
  formatUptime: (v: string | undefined) => (v ? 'some uptime' : ''),
}));

vi.mock('../useReactiveQuery', () => ({
  useReactiveQuery: (opts: { query: unknown; pause?: boolean; variables?: unknown }) => {
    useReactiveQueryMock(opts);

    const key = String(opts.query).slice(0, 80);
    for (const [k, v] of Object.entries(queryResults)) {
      if (key.includes(k)) {
        if (k === 'SystemDashboard') {
          return [v[0], mockReexecuteSystem];
        }
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
  queryResults.SystemDashboard = [
    {
      data: {
        system: {
          __typename: 'OpenClawSystem',
          gateway: { running: true, startedAt: '2025-02-22T00:00:00Z' },
          resources: { cpu: 2.1, memoryMB: 85 },
          channels: [{ provider: 'telegram', name: 'Telegram', connected: true, latencyMs: 12 }],
        },
      },
      fetching: false,
      error: undefined,
    },
  ];
}

describe('useGatewayData', () => {
  beforeEach(() => {
    mockConnection = 'connected';
    mockReexecuteSystem.mockReset();
    useReactiveQueryMock.mockReset();
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    for (const key of Object.keys(queryResults)) {
      delete queryResults[key];
    }
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

  it('uses SystemDashboardQuery with trace requestId', () => {
    setDefaultQueryResults();

    renderHook(() => useGatewayData());

    expect(
      useReactiveQueryMock.mock.calls.some((call) => {
        const opts = toQueryCallOptions(call);
        return (
          opts?.query === 'SystemDashboardQuery' && opts.variables?.context?.trace?.requestId === 'dashboard-topbar'
        );
      }),
    ).toBe(true);
  });

  it('maps OpenClawSystem payload to existing return contract', () => {
    setDefaultQueryResults();

    const { result } = renderHook(() => useGatewayData());

    expect(result.current.status).toBe('running');
    expect(result.current.gateway?.running).toBe(true);
    expect(result.current.resources).toEqual({ cpu: 2.1, memoryMB: 85 });
    expect(result.current.channels).toHaveLength(1);
  });

  it('returns gateway-down when system payload is null', () => {
    queryResults.SystemDashboard = [{ data: { system: null }, fetching: false, error: undefined }];

    const { result } = renderHook(() => useGatewayData());

    expect(result.current.status).toBe('gateway-down');
    expect(result.current.gateway).toBeUndefined();
  });

  it('returns connecting when fetching and no data yet', () => {
    queryResults.SystemDashboard = [{ data: undefined, fetching: true, error: undefined }];

    const { result } = renderHook(() => useGatewayData());

    expect(result.current.status).toBe('connecting');
    expect(result.current.fetching.gateway).toBe(true);
  });

  it('returns dashboard-offline when connection is reconnecting', () => {
    mockConnection = 'reconnecting';
    setDefaultQueryResults();

    const { result } = renderHook(() => useGatewayData());

    expect(result.current.status).toBe('dashboard-offline');
  });

  it('returns empty channels when system typename mismatches', () => {
    queryResults.SystemDashboard = [
      { data: { system: { __typename: 'SystemUnavailable' } }, fetching: false, error: undefined },
    ];

    const { result } = renderHook(() => useGatewayData());

    expect(result.current.channels).toEqual([]);
  });
});
