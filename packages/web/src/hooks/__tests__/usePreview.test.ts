import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const mockUseQuery = vi.fn(() => [{ data: null, fetching: false, error: null }, vi.fn()]);

vi.mock('urql', () => ({
  useQuery: (...args: any[]) => mockUseQuery(...args),
}));

vi.mock('../../graphql/events-queries', () => ({
  EventsQuery: 'query Events { events { events { timestamp type } } }',
}));

import { usePreview } from '../usePreview';
import type { BucketData } from '../useMetricsData';

const makeBuckets = (count: number): BucketData[] =>
  Array.from({ length: count }, (_, i) => ({
    epochStart: 1000 + i * 3600,
    label: `${i}h`,
    tokens: 0,
    cost: 0,
    sessions: 0,
    errors: 0,
    uptime: 1,
  })) as BucketData[];

describe('usePreview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue([{ data: null, fetching: false, error: null }, vi.fn()]);
  });

  it('starts with no preview', () => {
    const { result } = renderHook(() => usePreview(makeBuckets(3), 3600));
    expect(result.current.preview).toBeNull();
    expect(result.current.previewEvents).toBeUndefined();
  });

  it('handleErrorClick sets preview for errors', () => {
    const { result } = renderHook(() => usePreview(makeBuckets(3), 3600));
    act(() => result.current.handleErrorClick(1));
    expect(result.current.preview).toEqual({
      source: 'errors',
      bucketIndex: 1,
      fromTs: 4600,
      toTs: 4600 + 3600,
      types: ['error', 'warning'],
    });
  });

  it('handleErrorClick toggles off on same index', () => {
    const { result } = renderHook(() => usePreview(makeBuckets(3), 3600));
    act(() => result.current.handleErrorClick(1));
    expect(result.current.preview).not.toBeNull();
    act(() => result.current.handleErrorClick(1));
    expect(result.current.preview).toBeNull();
  });

  it('handleUptimeClick sets preview for uptime', () => {
    const { result } = renderHook(() => usePreview(makeBuckets(3), 3600));
    act(() => result.current.handleUptimeClick(0));
    expect(result.current.preview?.source).toBe('uptime');
    expect(result.current.preview?.types).toEqual(['gateway_restart']);
  });

  it('handleUptimeClick toggles off on same index', () => {
    const { result } = renderHook(() => usePreview(makeBuckets(3), 3600));
    act(() => result.current.handleUptimeClick(0));
    act(() => result.current.handleUptimeClick(0));
    expect(result.current.preview).toBeNull();
  });

  it('closePreview clears preview', () => {
    const { result } = renderHook(() => usePreview(makeBuckets(3), 3600));
    act(() => result.current.handleErrorClick(0));
    act(() => result.current.closePreview());
    expect(result.current.preview).toBeNull();
  });

  it('ignores click on invalid bucket index', () => {
    const { result } = renderHook(() => usePreview(makeBuckets(2), 3600));
    act(() => result.current.handleErrorClick(99));
    expect(result.current.preview).toBeNull();
  });

  it('ignores click on bucket without epochStart', () => {
    const buckets = [{ label: '0h' } as any];
    const { result } = renderHook(() => usePreview(buckets, 3600));
    act(() => result.current.handleErrorClick(0));
    expect(result.current.preview).toBeNull();
  });

  it('passes events query results when preview is set', () => {
    mockUseQuery.mockReturnValue([{
      data: { events: { events: [{ timestamp: '2026-01-01', type: 'error' }], total: 1 } },
      fetching: false,
      error: null,
    }, vi.fn()]);

    const { result } = renderHook(() => usePreview(makeBuckets(3), 3600));
    act(() => result.current.handleErrorClick(0));
    expect(result.current.previewEvents).toBeDefined();
  });

  it('switching from error to uptime on same bucket changes source', () => {
    const { result } = renderHook(() => usePreview(makeBuckets(3), 3600));
    act(() => result.current.handleErrorClick(1));
    expect(result.current.preview?.source).toBe('errors');
    act(() => result.current.handleUptimeClick(1));
    expect(result.current.preview?.source).toBe('uptime');
  });
});
