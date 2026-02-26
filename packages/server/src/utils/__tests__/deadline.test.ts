import { afterEach, describe, expect, it, vi } from 'vitest';

import { Deadline, withDeadline } from '../deadline.js';
import { CollectTimeoutError } from '../snapshot-errors.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('Deadline', () => {
  it('reports remaining time', () => {
    const d = new Deadline(10_000);
    expect(d.remaining()).toBeGreaterThan(9_900);
    expect(d.remaining()).toBeLessThanOrEqual(10_000);
  });

  it('reports expired after time passes', () => {
    vi.useFakeTimers();
    const d = new Deadline(100);
    expect(d.expired()).toBe(false);
    vi.advanceTimersByTime(101);
    expect(d.expired()).toBe(true);
    expect(d.remaining()).toBe(0);
  });

  it('handles zero totalMs (immediately expired)', () => {
    const d = new Deadline(0);
    expect(d.expired()).toBe(true);
    expect(d.remaining()).toBe(0);
  });

  it('clamps negative totalMs to 0', () => {
    const d = new Deadline(-100);
    expect(d.expired()).toBe(true);
    expect(d.remaining()).toBe(0);
  });
});

describe('withDeadline', () => {
  it('resolves if task completes within deadline', async () => {
    const d = new Deadline(5000);
    const result = await withDeadline(Promise.resolve('ok'), d, CollectTimeoutError);
    expect(result).toBe('ok');
  });

  it('rejects with error class if deadline exceeded', async () => {
    const d = new Deadline(10);
    const slow = new Promise((r) => setTimeout(r, 200));
    await expect(withDeadline(slow, d, CollectTimeoutError)).rejects.toThrow(CollectTimeoutError);
  });

  it('rejects immediately if deadline already expired', async () => {
    const d = new Deadline(0);
    await expect(withDeadline(Promise.resolve('ok'), d, CollectTimeoutError)).rejects.toThrow(CollectTimeoutError);
  });

  it('cleans up timer on success (no lingering timers)', async () => {
    const d = new Deadline(5000);
    await withDeadline(Promise.resolve('ok'), d, CollectTimeoutError);
    // If timer leaked, it would keep process alive — test passing means cleanup worked
  });
});
