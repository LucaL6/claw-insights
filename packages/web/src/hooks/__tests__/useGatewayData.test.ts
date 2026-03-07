import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DashboardConnection } from '../useConnectionStatus';

let mockConnection: DashboardConnection = 'connected';
const mockReexecuteGateway = vi.fn();
const mockReexecuteSystemV2 = vi.fn();
const mockIsSchemaV2Enabled = vi.fn(() => false);

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

const hasQueryCall = (query: string, pause?: boolean): boolean =>
  useReactiveQueryMock.mock.calls.some((call) => {
    const opts = toQueryCallOptions(call);
    if (!opts || opts.query !== query) {
      return false;
    }
    return pause === undefined ? true : opts.pause === pause;
  });

vi.mock('../../config/feature-flags', () => ({
  isSchemaV2Enabled: () => mockIsSchemaV2Enabled(),
}));

vi.mock('../../graphql/queries', () => ({
  GatewayQuery: 'GatewayQuery',
  ResourcesQuery: 'ResourcesQuery',
  ChannelsQuery: 'ChannelsQuery',
}));

vi.mock('../../graphql/queries-v2', () => ({
  SystemDashboardV2Query: 'SystemDashboardV2Query',
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
        if (k === 'Gateway') {
          return [v[0], mockReexecuteGateway];
        }
        if (k === 'SystemDashboardV2') {
          return [v[0], mockReexecuteSystemV2];
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

function setDefaultV1QueryResults() {
  queryResults.Gateway = [{ data: { gateway: { running: true, startedAt: '2025-02-22T00:00:00Z' } }, fetching: false }];
  queryResults.Resources = [{ data: { resources: { cpu: 2.1, memoryMB: 85 } }, fetching: false }];
  queryResults.Channels = [
    {
      data: { channels: [{ provider: 'telegram', name: 'Telegram', connected: true, latencyMs: 12 }] },
      fetching: false,
    },
  ];
}

function setDefaultV2QueryResults() {
  queryResults.SystemDashboardV2 = [
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
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    mockConnection = 'connected';
    mockIsSchemaV2Enabled.mockReturnValue(false);
    mockReexecuteGateway.mockReset();
    mockReexecuteSystemV2.mockReset();
    useReactiveQueryMock.mockReset();
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', { value: 'visible', writable: true, configurable: true });
    for (const key of Object.keys(queryResults)) {
      delete queryResults[key];
    }
  });

  afterEach(() => {
    vi.useRealTimers();
    consoleWarnSpy.mockRestore();
  });

  it('uses v1 path by default and returns status=running when gateway.running is true', () => {
    setDefaultV1QueryResults();

    const { result } = renderHook(() => useGatewayData());
    expect(result.current.status).toBe('running');
    expect(result.current.resources).toEqual({ cpu: 2.1, memoryMB: 85 });
    expect(result.current.channels).toHaveLength(1);
    expect(result.current.uptime).toBeDefined();
  });

  it('uses SystemDashboardV2Query when schema v2 is enabled with trace requestId', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    setDefaultV2QueryResults();

    renderHook(() => useGatewayData());

    expect(
      useReactiveQueryMock.mock.calls.some((call) => {
        const opts = toQueryCallOptions(call);
        return (
          opts?.query === 'SystemDashboardV2Query' && opts.variables?.context?.trace?.requestId === 'dashboard-topbar'
        );
      }),
    ).toBe(true);
  });

  it('maps OpenClawSystem payload to existing return contract', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    setDefaultV2QueryResults();

    const { result } = renderHook(() => useGatewayData());

    expect(result.current.status).toBe('running');
    expect(result.current.gateway?.running).toBe(true);
    expect(result.current.resources).toEqual({ cpu: 2.1, memoryMB: 85 });
    expect(result.current.channels).toHaveLength(1);
  });

  it('falls back to v1 when v2 system payload is missing', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    queryResults.SystemDashboardV2 = [{ data: { system: null }, fetching: false, error: undefined }];
    setDefaultV1QueryResults();

    renderHook(() => useGatewayData());

    expect(hasQueryCall('GatewayQuery', false)).toBe(true);
  });

  it('falls back to v1 when v2 system union typename mismatches', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    queryResults.SystemDashboardV2 = [
      { data: { system: { __typename: 'SystemUnavailable' } }, fetching: false, error: undefined },
    ];
    setDefaultV1QueryResults();

    renderHook(() => useGatewayData());

    expect(hasQueryCall('GatewayQuery', false)).toBe(true);
  });

  it('falls back to v1 when v2 query hits network error', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    queryResults.SystemDashboardV2 = [
      { data: undefined, fetching: false, error: { networkError: new Error('boom'), graphQLErrors: [] } },
    ];
    setDefaultV1QueryResults();

    renderHook(() => useGatewayData());

    expect(hasQueryCall('GatewayQuery', false)).toBe(true);
  });

  it('falls back to v1 when v2 query has whitelisted GraphQL error code', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    queryResults.SystemDashboardV2 = [
      {
        data: undefined,
        fetching: false,
        error: { networkError: undefined, graphQLErrors: [{ extensions: { code: 'SOURCE_NOT_FOUND' } }] },
      },
    ];
    setDefaultV1QueryResults();

    renderHook(() => useGatewayData());

    expect(hasQueryCall('GatewayQuery', false)).toBe(true);
  });

  it('periodically retries v2 by clearing fallback window explicitly', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    queryResults.SystemDashboardV2 = [{ data: { system: null }, fetching: false, error: undefined }];
    setDefaultV1QueryResults();

    renderHook(() => useGatewayData());

    queryResults.SystemDashboardV2 = [
      {
        data: {
          system: {
            __typename: 'OpenClawSystem',
            gateway: { running: true, startedAt: '2025-02-22T00:00:00Z' },
            resources: { cpu: 2.1, memoryMB: 85 },
            channels: [],
          },
        },
        fetching: false,
        error: undefined,
      },
    ];

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(hasQueryCall('SystemDashboardV2Query', false)).toBe(true);
  });
});
