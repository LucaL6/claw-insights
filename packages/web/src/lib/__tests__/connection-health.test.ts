import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectionHealthStore } from '../connection-health';

describe('ConnectionHealthStore', () => {
  let store: ConnectionHealthStore;

  beforeEach(() => {
    vi.useFakeTimers();
    store = new ConnectionHealthStore(15_000);
  });

  afterEach(() => {
    store.destroy();
    vi.useRealTimers();
  });

  it('starts as not-ever-connected', () => {
    expect(store.getSnapshot().everConnected).toBe(false);
    expect(store.getSnapshot().isOffline).toBe(false);
  });

  it('transitions to connected on first successful fetch', () => {
    store.reportFetchSuccess();
    const snap = store.getSnapshot();
    expect(snap.everConnected).toBe(true);
    expect(snap.isOffline).toBe(false);
  });

  it('SSE healthy uses OR across sources', () => {
    store.reportSseHealth('rq-1', true);
    store.reportSseHealth('rq-2', false);
    expect(store.getSnapshot().sseHealthy).toBe(true);
  });

  it('SSE all unhealthy', () => {
    store.reportSseHealth('rq-1', false);
    store.reportSseHealth('rq-2', false);
    expect(store.getSnapshot().sseHealthy).toBe(false);
  });

  it('empty SSE map treated as neutral (not unhealthy)', () => {
    expect(store.getSnapshot().sseHealthy).toBe(true);
  });

  it('unregister one instance does not affect another', () => {
    store.reportSseHealth('rq-1', true);
    store.reportSseHealth('rq-2', true);
    store.unregisterSse('rq-1');
    expect(store.getSnapshot().sseHealthy).toBe(true);
  });

  it('unregister all instances → sseHealthy returns to neutral (true)', () => {
    store.reportSseHealth('rq-1', true);
    store.unregisterSse('rq-1');
    expect(store.getSnapshot().sseHealthy).toBe(true);
  });

  it('stays connected during grace period after SSE + fetch failure', () => {
    store.reportFetchSuccess();
    store.reportSseHealth('rq-1', true);
    store.reportSseHealth('rq-1', false);
    store.reportFetchFailure();
    vi.advanceTimersByTime(10_000);
    expect(store.getSnapshot().isOffline).toBe(false);
  });

  it('goes offline after grace period expires', () => {
    store.reportFetchSuccess();
    store.reportSseHealth('rq-1', true);
    store.reportSseHealth('rq-1', false);
    store.reportFetchFailure();
    vi.advanceTimersByTime(15_001);
    expect(store.getSnapshot().isOffline).toBe(true);
  });

  it('grace timer calculates exact deadline from lastSuccessTs', () => {
    store.reportFetchSuccess();
    store.reportSseHealth('rq-1', true);
    vi.advanceTimersByTime(5_000);
    store.reportSseHealth('rq-1', false);
    store.reportFetchFailure();
    vi.advanceTimersByTime(9_999);
    expect(store.getSnapshot().isOffline).toBe(false);
    vi.advanceTimersByTime(2);
    expect(store.getSnapshot().isOffline).toBe(true);
  });

  it('grace timer reschedules on repeated failures', () => {
    store.reportFetchSuccess();
    store.reportSseHealth('rq-1', true);
    vi.advanceTimersByTime(2_000);
    store.reportSseHealth('rq-1', false);
    store.reportFetchFailure();
    vi.advanceTimersByTime(3_000);
    store.reportSseHealth('rq-1', true);
    expect(store.getSnapshot().isOffline).toBe(false);
    store.reportFetchSuccess();
    vi.advanceTimersByTime(5_000);
    store.reportSseHealth('rq-1', false);
    store.reportFetchFailure();
    vi.advanceTimersByTime(9_999);
    expect(store.getSnapshot().isOffline).toBe(false);
    vi.advanceTimersByTime(2);
    expect(store.getSnapshot().isOffline).toBe(true);
  });

  it('fetch failure alone (SSE healthy) does NOT trigger grace timer', () => {
    store.reportFetchSuccess();
    store.reportSseHealth('rq-1', true);
    store.reportFetchFailure();
    vi.advanceTimersByTime(20_000);
    expect(store.getSnapshot().isOffline).toBe(false);
  });

  it('recovers from offline on successful fetch', () => {
    store.reportFetchSuccess();
    store.reportSseHealth('rq-1', false);
    store.reportFetchFailure();
    vi.advanceTimersByTime(16_000);
    expect(store.getSnapshot().isOffline).toBe(true);
    store.reportFetchSuccess();
    expect(store.getSnapshot().isOffline).toBe(false);
  });

  it('recovers from offline when SSE becomes healthy', () => {
    store.reportFetchSuccess();
    store.reportSseHealth('rq-1', false);
    store.reportFetchFailure();
    vi.advanceTimersByTime(16_000);
    expect(store.getSnapshot().isOffline).toBe(true);
    store.reportSseHealth('rq-1', true);
    expect(store.getSnapshot().isOffline).toBe(false);
  });

  it('grace timer cancelled on fetch recovery', () => {
    store.reportFetchSuccess();
    store.reportSseHealth('rq-1', false);
    store.reportFetchFailure();
    vi.advanceTimersByTime(10_000);
    store.reportFetchSuccess();
    vi.advanceTimersByTime(10_000);
    expect(store.getSnapshot().isOffline).toBe(false);
  });

  it('grace timer cancelled on SSE recovery', () => {
    store.reportFetchSuccess();
    store.reportSseHealth('rq-1', false);
    store.reportFetchFailure();
    vi.advanceTimersByTime(10_000);
    store.reportSseHealth('rq-1', true);
    vi.advanceTimersByTime(10_000);
    expect(store.getSnapshot().isOffline).toBe(false);
  });

  it('notifies listeners on state change', () => {
    const listener = vi.fn();
    store.subscribe(listener);
    store.reportFetchSuccess();
    expect(listener).toHaveBeenCalled();
  });

  it('unsubscribe stops notifications', () => {
    const listener = vi.fn();
    const unsub = store.subscribe(listener);
    unsub();
    store.reportFetchSuccess();
    expect(listener).not.toHaveBeenCalled();
  });

  it('reportFetchFailure does NOT notify listeners', () => {
    store.reportFetchSuccess();
    store.reportSseHealth('rq-1', false);
    const listener = vi.fn();
    store.subscribe(listener);
    store.reportFetchFailure();
    expect(listener).not.toHaveBeenCalled();
  });

  it('reportFetchSuccess in steady state does NOT notify listeners', () => {
    store.reportFetchSuccess();
    const listener = vi.fn();
    store.subscribe(listener);
    store.reportFetchSuccess();
    expect(listener).not.toHaveBeenCalled();
  });

  it('reportSseHealth with same value does NOT notify listeners', () => {
    store.reportSseHealth('rq-1', true);
    const listener = vi.fn();
    store.subscribe(listener);
    store.reportSseHealth('rq-1', true);
    expect(listener).not.toHaveBeenCalled();
  });

  it('getSnapshot returns same reference if state unchanged', () => {
    store.reportFetchSuccess();
    const snap1 = store.getSnapshot();
    const snap2 = store.getSnapshot();
    expect(snap1).toBe(snap2);
  });

  it('getSnapshot is pure — no Date.now() dependency', () => {
    store.reportFetchSuccess();
    const snap1 = store.getSnapshot();
    vi.advanceTimersByTime(5_000);
    const snap2 = store.getSnapshot();
    expect(snap1).toBe(snap2);
  });

  it('unregisterSse on unknown source is a no-op', () => {
    const listener = vi.fn();
    store.subscribe(listener);
    store.unregisterSse('never-registered');
    expect(listener).not.toHaveBeenCalled();
  });

  it('unregisterSse triggers grace when remaining sources are unhealthy', () => {
    store.reportFetchSuccess();
    store.reportSseHealth('rq-1', true);
    store.reportSseHealth('rq-2', false);
    const listener = vi.fn();
    store.subscribe(listener);
    // removing the only healthy source → newAgg becomes false → grace scheduled
    // oldAgg was true, newAgg is false → _invalidate called
    store.unregisterSse('rq-1');
    expect(store.getSnapshot().sseHealthy).toBe(false);
    expect(listener).toHaveBeenCalled();
    // grace timer should fire
    vi.advanceTimersByTime(15_001);
    expect(store.getSnapshot().isOffline).toBe(true);
  });

  it('_maybeScheduleGrace early-returns when already offline', () => {
    store.reportFetchSuccess();
    store.reportSseHealth('rq-1', false);
    vi.advanceTimersByTime(15_001);
    expect(store.getSnapshot().isOffline).toBe(true);
    const listener = vi.fn();
    store.subscribe(listener);
    // This calls _maybeScheduleGrace but should early-return since already offline
    store.reportFetchFailure();
    vi.advanceTimersByTime(20_000);
    expect(listener).not.toHaveBeenCalled();
  });

  it('destroy clears timer and listeners', () => {
    const listener = vi.fn();
    store.subscribe(listener);
    store.reportFetchSuccess();
    store.reportSseHealth('rq-1', false);
    store.reportFetchFailure();
    const callsBefore = listener.mock.calls.length;
    store.destroy();
    vi.advanceTimersByTime(20_000);
    expect(listener.mock.calls.length).toBe(callsBefore);
  });
});
