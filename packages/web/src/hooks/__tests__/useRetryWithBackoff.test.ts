import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RetryState } from '../useRetryWithBackoff';
import { RETRY_INIT, retryReducer, useRetryWithBackoff } from '../useRetryWithBackoff';

// ── Reducer unit tests (pure function) ──

describe('retryReducer', () => {
  it('tick: increments attempt and sets phase to scheduled', () => {
    const state: RetryState = { phase: 'idle', attempt: 0 };
    expect(retryReducer(state, { type: 'tick' })).toEqual({ phase: 'scheduled', attempt: 1 });
  });

  it('tick: continues incrementing from scheduled', () => {
    const state: RetryState = { phase: 'scheduled', attempt: 2 };
    expect(retryReducer(state, { type: 'tick' })).toEqual({ phase: 'scheduled', attempt: 3 });
  });

  it('tick: resumes from deferred to scheduled', () => {
    const state: RetryState = { phase: 'deferred', attempt: 1 };
    expect(retryReducer(state, { type: 'tick' })).toEqual({ phase: 'scheduled', attempt: 2 });
  });

  it('defer: sets phase to deferred, keeps attempt', () => {
    const state: RetryState = { phase: 'scheduled', attempt: 3 };
    expect(retryReducer(state, { type: 'defer' })).toEqual({ phase: 'deferred', attempt: 3 });
  });

  it('defer: returns same reference when already deferred (idempotent)', () => {
    const state: RetryState = { phase: 'deferred', attempt: 2 };
    expect(retryReducer(state, { type: 'defer' })).toBe(state);
  });

  it('defer: returns same reference when idle (no-op)', () => {
    const state: RetryState = { phase: 'idle', attempt: 0 };
    expect(retryReducer(state, { type: 'defer' })).toBe(state);
  });

  it('reset: returns to initial state', () => {
    const state: RetryState = { phase: 'deferred', attempt: 5 };
    expect(retryReducer(state, { type: 'reset' })).toBe(RETRY_INIT);
  });

  it('reset from idle returns same reference (React bailout)', () => {
    expect(retryReducer(RETRY_INIT, { type: 'reset' })).toBe(RETRY_INIT);
  });
});

// ── Hook integration tests ──

describe('useRetryWithBackoff', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when inactive', () => {
    const onRetry = vi.fn();
    renderHook(() => useRetryWithBackoff(false, onRetry));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('calls onRetry after baseMs when active', () => {
    const onRetry = vi.fn();
    renderHook(() => useRetryWithBackoff(true, onRetry));
    expect(onRetry).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('self-chains with exponential backoff: 5s → 10s → 20s → 30s (capped)', () => {
    const onRetry = vi.fn();
    renderHook(() => useRetryWithBackoff(true, onRetry));

    // 1st retry at 5s (attempt 0 → delay = 5000 * 2^0 = 5s)
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onRetry).toHaveBeenCalledTimes(1);

    // 2nd retry at +10s (attempt 1 → delay = 5000 * 2^1 = 10s)
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onRetry).toHaveBeenCalledTimes(2);

    // 3rd retry at +20s (attempt 2 → delay = 5000 * 2^2 = 20s)
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    expect(onRetry).toHaveBeenCalledTimes(3);

    // 4th retry at +30s (attempt 3 → delay = min(5000 * 2^3, 30000) = 30s capped)
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(onRetry).toHaveBeenCalledTimes(4);
  });

  it('resets attempt count when deactivated and reactivated', () => {
    const onRetry = vi.fn();
    const { rerender } = renderHook(({ active }) => useRetryWithBackoff(active, onRetry), {
      initialProps: { active: true },
    });

    // 1st retry at 5s
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onRetry).toHaveBeenCalledTimes(1);

    // Deactivate
    rerender({ active: false });

    // Reactivate — should start at 5s again (attempt reset to 0), not 10s
    rerender({ active: true });
    onRetry.mockReset();
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('defers retry when tab is hidden, fires on visibility restore', () => {
    const onRetry = vi.fn();
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });

    renderHook(() => useRetryWithBackoff(true, onRetry));

    // Timer fires while hidden → deferred, should NOT call onRetry
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onRetry).not.toHaveBeenCalled();

    // Tab becomes visible → pending retry fires
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('continues backoff chain after visibility restore', () => {
    const onRetry = vi.fn();
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });

    renderHook(() => useRetryWithBackoff(true, onRetry));

    // 1st timer fires hidden → deferred
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onRetry).not.toHaveBeenCalled();

    // Restore visibility → fires retry (attempt 0 → 1), schedules next at 10s
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(onRetry).toHaveBeenCalledTimes(1);

    // 2nd retry at 10s (attempt 1)
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  it('cleans up timer when deactivated while in scheduled state', () => {
    const onRetry = vi.fn();
    const { rerender } = renderHook(({ active }) => useRetryWithBackoff(active, onRetry), {
      initialProps: { active: true },
    });

    // Timer is scheduled (5s), deactivate before it fires
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    rerender({ active: false });

    // Advance past original timer — should NOT fire (cleanup cleared it)
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('cleans up when deactivated while in deferred state', () => {
    const onRetry = vi.fn();
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });

    const { rerender } = renderHook(({ active }) => useRetryWithBackoff(active, onRetry), {
      initialProps: { active: true },
    });

    // Timer fires hidden → deferred
    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    // Deactivate while hidden
    rerender({ active: false });

    // Tab becomes visible → should NOT fire (deactivated, reset to idle)
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('uses latest callback without re-entering effect', () => {
    const onRetry1 = vi.fn();
    const onRetry2 = vi.fn();

    const { rerender } = renderHook(({ cb }) => useRetryWithBackoff(true, cb), { initialProps: { cb: onRetry1 } });

    // Change callback before timer fires
    rerender({ cb: onRetry2 });

    // Timer fires — should call onRetry2 (latest), not onRetry1
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(onRetry1).not.toHaveBeenCalled();
    expect(onRetry2).toHaveBeenCalledTimes(1);
  });

  it('respects custom baseMs and maxMs parameters', () => {
    const onRetry = vi.fn();
    renderHook(() => useRetryWithBackoff(true, onRetry, { baseMs: 1_000, maxMs: 4_000 }));

    // 1st retry at 1s (1000 * 2^0)
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(onRetry).toHaveBeenCalledTimes(1);

    // 2nd retry at +2s (1000 * 2^1)
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(onRetry).toHaveBeenCalledTimes(2);

    // 3rd retry at +4s (min(1000 * 2^2, 4000) = 4s capped)
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(onRetry).toHaveBeenCalledTimes(3);

    // 4th retry at +4s (still capped at 4s)
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(onRetry).toHaveBeenCalledTimes(4);
  });
});
