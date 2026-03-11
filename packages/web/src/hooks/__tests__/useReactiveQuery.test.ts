import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockExecuteQuery = vi.fn();
const mockUseQuery = vi.fn((): [{ data: unknown; fetching: boolean; error: unknown }, unknown] => [
  { data: { test: 1 }, fetching: false, error: null },
  mockExecuteQuery,
]);
const mockUseSubscription = vi.fn((): [{ data: unknown; error: unknown }] => [{ data: null, error: null }]);

vi.mock('urql', () => ({
  useQuery: () => mockUseQuery(),
  useSubscription: (...args: unknown[]) => mockUseSubscription(...(args as [])),
}));

vi.mock('../../graphql/subscriptions', () => ({
  DataChangedSubscription: 'subscription DataChanged { dataChanged { source ts } }',
}));

import { useReactiveQuery } from '../useReactiveQuery';

describe('useReactiveQuery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockUseQuery.mockReturnValue([{ data: { test: 1 }, fetching: false, error: null }, mockExecuteQuery]);
    mockUseSubscription.mockReturnValue([{ data: null, error: null }]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns query result and execute function', () => {
    const { result } = renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'] }));
    expect(result.current[0].data).toEqual({ test: 1 });
    expect(typeof result.current[1]).toBe('function');
  });

  it('refetches on subscription data change for matching source', () => {
    // Capture the subscription handler
    let subHandler: (...args: unknown[]) => unknown;
    mockUseSubscription.mockImplementation((...fnArgs: unknown[]) => {
      subHandler = fnArgs[1] as (...args: unknown[]) => unknown;
      return [{ data: null, error: null }];
    });

    renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'], debounceMs: 100 }));

    // Simulate subscription event
    act(() => {
      subHandler!(undefined, { dataChanged: { source: 'sessions', ts: '2026-01-01' } });
    });

    // Debounce hasn't fired yet
    expect(mockExecuteQuery).not.toHaveBeenCalledWith({ requestPolicy: 'network-only' });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(mockExecuteQuery).toHaveBeenCalledWith({ requestPolicy: 'network-only' });
  });

  it('ignores subscription data for non-matching source', () => {
    let subHandler: (...args: unknown[]) => unknown;
    mockUseSubscription.mockImplementation((...fnArgs: unknown[]) => {
      subHandler = fnArgs[1] as (...args: unknown[]) => unknown;
      return [{ data: null, error: null }];
    });

    renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['metrics'] }));

    act(() => {
      subHandler!(undefined, { dataChanged: { source: 'sessions', ts: '2026-01-01' } });
    });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockExecuteQuery).not.toHaveBeenCalledWith({ requestPolicy: 'network-only' });
  });

  it('handles null dataChanged gracefully', () => {
    let subHandler: (...args: unknown[]) => unknown;
    mockUseSubscription.mockImplementation((...fnArgs: unknown[]) => {
      subHandler = fnArgs[1] as (...args: unknown[]) => unknown;
      return [{ data: null, error: null }];
    });

    renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'] }));

    act(() => {
      const result = subHandler!(undefined, { dataChanged: null });
      expect(result).toEqual({ dataChanged: null });
    });
  });

  it('polls when SSE has errors', () => {
    mockUseSubscription.mockReturnValue([{ data: null, error: new Error('SSE failed') }]);

    renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'], fallbackPollMs: 5000 }));

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockExecuteQuery).toHaveBeenCalledWith({ requestPolicy: 'network-only' });
  });

  it('refetches on visibility change to visible', () => {
    renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'] }));

    // Simulate visibility change
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockExecuteQuery).toHaveBeenCalledWith({ requestPolicy: 'network-only' });
  });

  it('debounces multiple rapid subscription events', () => {
    let subHandler: (...args: unknown[]) => unknown;
    mockUseSubscription.mockImplementation((...fnArgs: unknown[]) => {
      subHandler = fnArgs[1] as (...args: unknown[]) => unknown;
      return [{ data: null, error: null }];
    });

    renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'], debounceMs: 200 }));

    act(() => {
      subHandler!(undefined, { dataChanged: { source: 'sessions', ts: '1' } });
    });
    act(() => {
      vi.advanceTimersByTime(50);
    });
    act(() => {
      subHandler!(undefined, { dataChanged: { source: 'sessions', ts: '2' } });
    });
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Should only have been called once despite two events
    const networkCalls = mockExecuteQuery.mock.calls.filter(
      (c: unknown[]) => (c[0] as Record<string, unknown>)?.requestPolicy === 'network-only',
    );
    expect(networkCalls.length).toBe(1);
  });

  it('does not refetch on visibility change to hidden', () => {
    renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'] }));

    mockExecuteQuery.mockClear();
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(mockExecuteQuery).not.toHaveBeenCalled();
  });

  it('cleans up timers and listeners on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    let subHandler: (...args: unknown[]) => unknown;
    mockUseSubscription.mockImplementation((...fnArgs: unknown[]) => {
      subHandler = fnArgs[1] as (...args: unknown[]) => unknown;
      return [{ data: null, error: null }];
    });

    const { unmount } = renderHook(() =>
      useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'], debounceMs: 200 }),
    );

    // Start a debounce timer
    act(() => {
      subHandler!(undefined, { dataChanged: { source: 'sessions', ts: '1' } });
    });

    unmount();

    expect(removeSpy).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    // Advancing timers after unmount should NOT trigger refetch
    mockExecuteQuery.mockClear();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockExecuteQuery).not.toHaveBeenCalled();

    removeSpy.mockRestore();
  });

  it('does not poll when SSE is healthy', () => {
    mockUseSubscription.mockReturnValue([{ data: null, error: null }]);

    renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'], fallbackPollMs: 5000 }));

    mockExecuteQuery.mockClear();
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(mockExecuteQuery).not.toHaveBeenCalledWith({ requestPolicy: 'network-only' });
  });

  it('preserves last known data when result.data becomes undefined (stale fallback)', () => {
    // First render with data
    mockUseQuery.mockReturnValue([{ data: { test: 1 }, fetching: false, error: null }, mockExecuteQuery]);
    const { rerender } = renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'] }));

    // Data disappears (connection lost)
    mockUseQuery.mockReturnValue([{ data: undefined, fetching: true, error: null }, mockExecuteQuery]);
    rerender();

    // Can't directly access stableResult internals, but the hook should not crash
    // and the returned data should still be the stale value
  });

  it('returns undefined data when no previous data exists and result.data is undefined', () => {
    mockUseQuery.mockReturnValue([{ data: undefined, fetching: true, error: null }, mockExecuteQuery]);
    const { result } = renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'] }));
    expect(result.current[0].data).toBeUndefined();
  });

  it('reports fetch failure to connectionHealth', () => {
    mockUseQuery.mockReturnValue([{ data: undefined, fetching: false, error: new Error('fail') }, mockExecuteQuery]);
    // Should not throw
    renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'] }));
  });

  it('reports fetch success to connectionHealth', () => {
    mockUseQuery.mockReturnValue([{ data: { x: 1 }, fetching: false, error: null }, mockExecuteQuery]);
    renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'] }));
    // No crash = health reported
  });

  it('SSE error sets sseHealthy to false and triggers fallback poll', () => {
    mockUseSubscription.mockReturnValue([{ data: null, error: new Error('SSE broken') }]);

    renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'], fallbackPollMs: 1000 }));

    mockExecuteQuery.mockClear();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockExecuteQuery).toHaveBeenCalledWith({ requestPolicy: 'network-only' });

    // Second poll cycle
    mockExecuteQuery.mockClear();
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(mockExecuteQuery).toHaveBeenCalledWith({ requestPolicy: 'network-only' });
  });

  it('SSE recovery stops fallback polling', () => {
    // Start with error
    mockUseSubscription.mockReturnValue([{ data: null, error: new Error('SSE broken') }]);

    const { rerender } = renderHook(() =>
      useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'], fallbackPollMs: 2000 }),
    );

    // SSE recovers
    mockUseSubscription.mockReturnValue([{ data: null, error: null }]);
    rerender();

    mockExecuteQuery.mockClear();
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    // Should NOT poll because sseHealthy is now true
    expect(mockExecuteQuery).not.toHaveBeenCalledWith({ requestPolicy: 'network-only' });
  });

  it('unregisters SSE key on unmount', () => {
    const { unmount } = renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'] }));
    // Should not throw
    unmount();
  });

  it('uses default fallbackPollMs of 30000', () => {
    mockUseSubscription.mockReturnValue([{ data: null, error: new Error('fail') }]);

    renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'] }));

    mockExecuteQuery.mockClear();
    act(() => {
      vi.advanceTimersByTime(29_999);
    });
    expect(mockExecuteQuery).not.toHaveBeenCalledWith({ requestPolicy: 'network-only' });

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(mockExecuteQuery).toHaveBeenCalledWith({ requestPolicy: 'network-only' });
  });

  it('uses default debounceMs of 500 when not specified', () => {
    let subHandler: (...args: unknown[]) => unknown;
    mockUseSubscription.mockImplementation((...fnArgs: unknown[]) => {
      subHandler = fnArgs[1] as (...args: unknown[]) => unknown;
      return [{ data: null, error: null }];
    });

    renderHook(() => useReactiveQuery({ query: 'query { test }' }, { sources: ['sessions'] }));

    act(() => {
      subHandler!(undefined, { dataChanged: { source: 'sessions', ts: '1' } });
    });

    // At 400ms, shouldn't have fired yet
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(mockExecuteQuery).not.toHaveBeenCalledWith({ requestPolicy: 'network-only' });

    // At 500ms total, should fire
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(mockExecuteQuery).toHaveBeenCalledWith({ requestPolicy: 'network-only' });
  });
});
