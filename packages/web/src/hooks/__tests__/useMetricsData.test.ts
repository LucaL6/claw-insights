import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseReactiveQuery = vi.fn();

vi.mock('../../graphql/source-selector', () => ({
  getDashboardSourceSelector: () => ({ id: 'agent:main' }),
}));

vi.mock('../../graphql/queries', () => ({
  MetricsQuery: 'MetricsQuery',
}));

vi.mock('../useReactiveQuery', () => ({
  useReactiveQuery: (...args: unknown[]) => mockUseReactiveQuery(...args),
}));

import { useMetricsData } from '../useMetricsData';

const getCall = (query: string) => mockUseReactiveQuery.mock.calls.find((call) => call[0]?.query === query)?.[0];

describe('useMetricsData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  it('computes aggregates from source-centric buckets', () => {
    mockUseReactiveQuery.mockReturnValue([
      {
        data: {
          source: {
            __typename: 'AgentNamespace',
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
              totalTurns: 15,
            },
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
    expect(result.current.totalMessages).toBe(15);
  });

  it('passes selector, range, and context to MetricsQuery', () => {
    mockUseReactiveQuery.mockReturnValue([{ data: undefined, fetching: false, error: null }, vi.fn()]);

    renderHook(() => useMetricsData('SIX_HOUR'));

    const queryCall = getCall('MetricsQuery');
    expect(queryCall.variables).toEqual({
      selector: { id: 'agent:main' },
      range: 'SIX_HOUR',
      context: { trace: { requestId: 'dashboard-metrics' } },
    });
  });

  it('handles null source gracefully', () => {
    mockUseReactiveQuery.mockReturnValue([{ data: { source: null }, fetching: false, error: null }, vi.fn()]);

    const { result } = renderHook(() => useMetricsData('ONE_HOUR'));
    expect(result.current.buckets).toEqual([]);
    expect(result.current.peakSessions).toBe(0);
  });
});
