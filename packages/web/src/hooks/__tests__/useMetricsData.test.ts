import { renderHook } from '@testing-library/react';
import { beforeEach,describe, expect, it, vi } from 'vitest';

const mockUseReactiveQuery = vi.fn();
vi.mock('../useReactiveQuery', () => ({
  useReactiveQuery: (...args: unknown[]) => mockUseReactiveQuery(...args),
}));

import { useMetricsData } from '../useMetricsData';

describe('useMetricsData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty state when no data', () => {
    mockUseReactiveQuery.mockReturnValue([{
      data: undefined, fetching: true, error: null,
    }, vi.fn()]);

    const { result } = renderHook(() => useMetricsData('TWENTY_FOUR_HOUR'));
    expect(result.current.buckets).toEqual([]);
    expect(result.current.allModels).toEqual([]);
    expect(result.current.peakSessions).toBe(0);
    expect(result.current.totalTokensK).toBe(0);
    expect(result.current.fetching).toBe(true);
  });

  it('computes aggregates from buckets', () => {
    mockUseReactiveQuery.mockReturnValue([{
      data: {
        metrics: {
          buckets: [
            { bucket: 0, label: '00:00', sessions: 5, tokensK: 100, tokensByModel: [{ model: 'gpt-4', tokensK: 80 }, { model: 'claude', tokensK: 20 }], apiCalls: 10, toolCalls: 3, errors: 1, warnings: 0, gatewayUp: true, restartEvent: false },
            { bucket: 1, label: '01:00', sessions: 10, tokensK: 200, tokensByModel: [{ model: 'gpt-4', tokensK: 200 }], apiCalls: 20, toolCalls: 5, errors: 0, warnings: 2, gatewayUp: true, restartEvent: false },
          ],
          totalErrors: 1,
          totalWarnings: 2,
          uptimePercent: 99.5,
          bucketMinutes: 60,
        },
      },
      fetching: false, error: null,
    }, vi.fn()]);

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

  it('passes range to useReactiveQuery variables', () => {
    mockUseReactiveQuery.mockReturnValue([{
      data: undefined, fetching: false, error: null,
    }, vi.fn()]);

    renderHook(() => useMetricsData('ONE_HOUR'));
    const callArgs = mockUseReactiveQuery.mock.calls[0][0];
    expect(callArgs.variables).toEqual({ range: 'ONE_HOUR' });
  });
});
