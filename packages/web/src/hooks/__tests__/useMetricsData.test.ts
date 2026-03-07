import type { MetricsRange } from '@claw-insights/shared';
import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseReactiveQuery = vi.fn();
const mockIsSchemaV2Enabled = vi.fn(() => false);
const mockGetDashboardSourceSelector = vi.fn(() => ({ id: 'agent:main' }));

vi.mock('../../config/feature-flags', () => ({
  isSchemaV2Enabled: () => mockIsSchemaV2Enabled(),
}));

vi.mock('../../graphql/source-selector', () => ({
  getDashboardSourceSelector: () => mockGetDashboardSourceSelector(),
}));

vi.mock('../../graphql/queries', () => ({
  MetricsQuery: 'MetricsQuery',
}));

vi.mock('../../graphql/queries-v2', () => ({
  MetricsV2Query: 'MetricsV2Query',
}));

vi.mock('../useReactiveQuery', () => ({
  useReactiveQuery: (...args: unknown[]) => mockUseReactiveQuery(...args),
}));

import { useMetricsData } from '../useMetricsData';

const getCall = (query: string) => mockUseReactiveQuery.mock.calls.find((call) => call[0]?.query === query)?.[0];

const hasQueryCall = (query: string, pause?: boolean): boolean =>
  mockUseReactiveQuery.mock.calls.some((call) => {
    const opts = call[0] as { query?: string; pause?: boolean } | undefined;
    if (!opts || opts.query !== query) {
      return false;
    }
    return pause === undefined ? true : opts.pause === pause;
  });

describe('useMetricsData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSchemaV2Enabled.mockReturnValue(false);
    mockGetDashboardSourceSelector.mockReturnValue({ id: 'agent:main' });
  });

  it('returns empty state when no data', () => {
    mockUseReactiveQuery.mockReturnValue([{ data: undefined, fetching: true, error: null }, vi.fn()]);

    const { result } = renderHook(() => useMetricsData('TWENTY_FOUR_HOUR'));
    expect(result.current.buckets).toEqual([]);
    expect(result.current.allModels).toEqual([]);
    expect(result.current.peakSessions).toBe(0);
    expect(result.current.totalTokensK).toBe(0);
    expect(result.current.fetching).toBe(true);
  });

  it('computes aggregates from buckets', () => {
    mockUseReactiveQuery.mockReturnValue([
      {
        data: {
          metrics: {
            buckets: [
              {
                bucket: 0,
                label: '00:00',
                sessions: 5,
                tokensK: 100,
                tokensByModel: [
                  { model: 'gpt-4', tokensK: 80 },
                  { model: 'claude', tokensK: 20 },
                ],
                apiCalls: 10,
                toolCalls: 3,
                errors: 1,
                warnings: 0,
                gatewayUp: true,
                restartEvent: false,
              },
              {
                bucket: 1,
                label: '01:00',
                sessions: 10,
                tokensK: 200,
                tokensByModel: [{ model: 'gpt-4', tokensK: 200 }],
                apiCalls: 20,
                toolCalls: 5,
                errors: 0,
                warnings: 2,
                gatewayUp: true,
                restartEvent: false,
              },
            ],
            totalErrors: 1,
            totalWarnings: 2,
            uptimePercent: 99.5,
            bucketMinutes: 60,
          },
        },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { result } = renderHook(() => useMetricsData('TWENTY_FOUR_HOUR'));
    expect(result.current.buckets).toHaveLength(2);
    expect(result.current.peakSessions).toBe(10);
    expect(result.current.totalTokensK).toBe(300);
    expect(result.current.totalErrors).toBe(1);
    expect(result.current.totalWarnings).toBe(2);
    expect(result.current.uptimePct).toBe(99.5);
    expect(result.current.bucketSeconds).toBe(3600);
    expect(result.current.allModels).toEqual(['claude', 'gpt-4']);
    expect(result.current.fetching).toBe(false);
  });

  it('passes range to useReactiveQuery variables on v1 path', () => {
    mockUseReactiveQuery.mockReturnValue([{ data: undefined, fetching: false, error: null }, vi.fn()]);

    renderHook(() => useMetricsData('ONE_HOUR'));
    const v1Call = getCall('MetricsQuery');
    expect(v1Call.variables).toEqual({ range: 'ONE_HOUR' });
  });

  it('uses MetricsV2Query with selector and context when schema v2 is enabled', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    mockUseReactiveQuery.mockImplementation((opts: { query: string }) => {
      if (opts.query === 'MetricsV2Query') {
        return [
          {
            data: { source: { __typename: 'AgentNamespace', metrics: { buckets: [] } } },
            fetching: false,
            error: null,
          },
          vi.fn(),
        ];
      }
      return [{ data: undefined, fetching: false, error: null }, vi.fn()];
    });

    renderHook(() => useMetricsData('SIX_HOUR'));

    const v2Call = getCall('MetricsV2Query');
    expect(v2Call.variables).toEqual({
      selector: { id: 'agent:main' },
      range: 'SIX_HOUR',
      context: { trace: { requestId: 'dashboard-metrics' } },
    });
  });

  it('reads metrics from data.source.metrics on v2 path', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    mockUseReactiveQuery.mockImplementation((opts: { query: string }) => {
      if (opts.query === 'MetricsV2Query') {
        return [
          {
            data: {
              source: {
                __typename: 'AgentNamespace',
                metrics: {
                  buckets: [{ bucket: 0, label: '00:00', sessions: 7, tokensK: 42 }],
                  totalTurns: 9,
                  totalErrors: 1,
                  totalWarnings: 2,
                  uptimePercent: 95,
                  bucketMinutes: 30,
                },
              },
            },
            fetching: false,
            error: null,
          },
          vi.fn(),
        ];
      }
      return [{ data: undefined, fetching: false, error: null }, vi.fn()];
    });

    const { result } = renderHook(() => useMetricsData('ONE_HOUR'));

    expect(result.current.buckets).toHaveLength(1);
    expect(result.current.buckets[0]?.sessions).toBe(7);
    expect(result.current.totalMessages).toBe(9);
  });

  it('falls back to v1 when v2 source is null', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    mockUseReactiveQuery.mockImplementation((opts: { query: string; pause?: boolean }) => {
      if (opts.query === 'MetricsV2Query') {
        return [{ data: { source: null }, fetching: false, error: null }, vi.fn()];
      }
      if (opts.query === 'MetricsQuery') {
        return [
          {
            data: { metrics: { buckets: [{ bucket: 0, label: '00:00', sessions: 3, tokensK: 10 }] } },
            fetching: false,
            error: null,
          },
          vi.fn(),
        ];
      }
      return [{ data: undefined, fetching: false, error: null }, vi.fn()];
    });

    const { result } = renderHook(() => useMetricsData('ONE_HOUR'));

    expect(hasQueryCall('MetricsQuery', false)).toBe(true);
    expect(result.current.buckets[0]?.sessions).toBe(3);
  });

  it('falls back to v1 when v2 has network error or whitelisted GraphQL error', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);

    mockUseReactiveQuery.mockImplementation((opts: { query: string }) => {
      if (opts.query === 'MetricsV2Query') {
        return [
          { data: undefined, fetching: false, error: { networkError: new Error('boom'), graphQLErrors: [] } },
          vi.fn(),
        ];
      }
      if (opts.query === 'MetricsQuery') {
        return [{ data: { metrics: { buckets: [] } }, fetching: false, error: null }, vi.fn()];
      }
      return [{ data: undefined, fetching: false, error: null }, vi.fn()];
    });

    renderHook(() => useMetricsData('ONE_HOUR'));
    expect(hasQueryCall('MetricsQuery', false)).toBe(true);

    mockUseReactiveQuery.mockClear();
    mockUseReactiveQuery.mockImplementation((opts: { query: string }) => {
      if (opts.query === 'MetricsV2Query') {
        return [
          {
            data: undefined,
            fetching: false,
            error: { networkError: undefined, graphQLErrors: [{ extensions: { code: 'SOURCE_NOT_FOUND' } }] },
          },
          vi.fn(),
        ];
      }
      if (opts.query === 'MetricsQuery') {
        return [{ data: { metrics: { buckets: [] } }, fetching: false, error: null }, vi.fn()];
      }
      return [{ data: undefined, fetching: false, error: null }, vi.fn()];
    });

    renderHook(() => useMetricsData('ONE_HOUR'));
    expect(hasQueryCall('MetricsQuery', false)).toBe(true);
  });

  it('resets fallback when range changes', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    mockUseReactiveQuery.mockImplementation((opts: { query: string }) => {
      if (opts.query === 'MetricsV2Query') {
        return [{ data: { source: null }, fetching: false, error: null }, vi.fn()];
      }
      return [{ data: { metrics: { buckets: [] } }, fetching: false, error: null }, vi.fn()];
    });

    const { rerender } = renderHook(({ range }: { range: MetricsRange }) => useMetricsData(range), {
      initialProps: { range: 'ONE_HOUR' as MetricsRange },
    });

    expect(hasQueryCall('MetricsQuery', false)).toBe(true);

    mockUseReactiveQuery.mockClear();
    mockUseReactiveQuery.mockImplementation((opts: { query: string; pause?: boolean }) => {
      if (opts.query === 'MetricsV2Query') {
        return [
          {
            data: { source: { __typename: 'AgentNamespace', metrics: { buckets: [] } } },
            fetching: false,
            error: null,
          },
          vi.fn(),
        ];
      }
      return [{ data: { metrics: { buckets: [] } }, fetching: false, error: null }, vi.fn()];
    });

    rerender({ range: 'SIX_HOUR' });

    expect(hasQueryCall('MetricsV2Query', false)).toBe(true);
  });

  it('resets fallback when selector changes', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    let selector = { id: 'agent:main' };
    mockGetDashboardSourceSelector.mockImplementation(() => selector);

    mockUseReactiveQuery.mockImplementation((opts: { query: string }) => {
      if (opts.query === 'MetricsV2Query') {
        return [{ data: { source: null }, fetching: false, error: null }, vi.fn()];
      }
      return [{ data: { metrics: { buckets: [] } }, fetching: false, error: null }, vi.fn()];
    });

    const { rerender } = renderHook(({ range }: { range: MetricsRange }) => useMetricsData(range), {
      initialProps: { range: 'ONE_HOUR' as MetricsRange },
    });

    expect(hasQueryCall('MetricsQuery', false)).toBe(true);

    selector = { id: 'agent:other' };
    mockUseReactiveQuery.mockClear();
    mockUseReactiveQuery.mockImplementation((opts: { query: string; pause?: boolean }) => {
      if (opts.query === 'MetricsV2Query') {
        return [
          {
            data: { source: { __typename: 'AgentNamespace', metrics: { buckets: [] } } },
            fetching: false,
            error: null,
          },
          vi.fn(),
        ];
      }
      return [{ data: { metrics: { buckets: [] } }, fetching: false, error: null }, vi.fn()];
    });

    rerender({ range: 'ONE_HOUR' });

    expect(hasQueryCall('MetricsV2Query', false)).toBe(true);
  });
});
