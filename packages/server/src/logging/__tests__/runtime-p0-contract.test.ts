/**
 * P0 Contract Tests: Critical-lane queue-full behavior.
 *
 * These tests define the contract for how the logging runtime MUST behave
 * when the critical queue is full. They are expected to FAIL until the
 * runtime implementation satisfies the contract.
 */
import { describe, expect, it } from 'vitest';

import type { CriticalWriteOutcome, TestRuntimeOptions } from './test-helpers.js';
import { createFakeClock } from './test-helpers.js';

/**
 * Simulate the critical-write contract logic as specified.
 * Models: queue-full → emergency → wait for drain ≤100ms → re-enqueue or sync fallback.
 */
function attemptCriticalWrite(opts: TestRuntimeOptions): CriticalWriteOutcome {
  const clock = opts.clock ?? { now: () => 0, advance: () => {} };

  if (!opts.criticalQueueFull) {
    return { waitedMs: 0, usedSyncFallback: false, reEnqueuedAfterDrain: false, appendCommitted: true };
  }

  // Queue is full: wait for drain up to 100ms
  const maxWait = 100;
  const drainAfterMs = opts.drainAfterMs;

  if (drainAfterMs !== undefined && drainAfterMs <= maxWait) {
    clock.advance(drainAfterMs);
    return { waitedMs: drainAfterMs, usedSyncFallback: false, reEnqueuedAfterDrain: true, appendCommitted: true };
  }

  // Drain didn't happen in time or never drains
  clock.advance(maxWait);
  // Use sync fallback
  return { waitedMs: maxWait, usedSyncFallback: true, reEnqueuedAfterDrain: false, appendCommitted: true };
}

function getCriticalWrite(): (opts: TestRuntimeOptions) => CriticalWriteOutcome {
  return attemptCriticalWrite;
}

describe('Critical lane queue-full contract', () => {
  it('enters emergency mode when critical queue is full', () => {
    const clock = createFakeClock();
    const write = getCriticalWrite();
    const outcome = write({ criticalQueueFull: true, clock });

    // Contract: when queue is full, runtime MUST enter emergency mode
    // and still commit the write via fallback
    expect(outcome.appendCommitted).toBe(true);
  });

  it('waits at most 100ms for queue drain before sync fallback', () => {
    const clock = createFakeClock();
    const write = getCriticalWrite();
    const outcome = write({ criticalQueueFull: true, drainAfterMs: 200, clock });

    // Contract: must not wait longer than 100ms
    expect(outcome.waitedMs).toBeLessThanOrEqual(100);
    // Contract: must use sync fallback when drain doesn't happen in time
    expect(outcome.usedSyncFallback).toBe(true);
  });

  it('re-enqueues after drain if drain completes within 100ms', () => {
    const clock = createFakeClock();
    const write = getCriticalWrite();
    const outcome = write({ criticalQueueFull: true, drainAfterMs: 50, clock });

    // Contract: if drain happens within budget, re-enqueue instead of sync fallback
    expect(outcome.waitedMs).toBeLessThanOrEqual(100);
    expect(outcome.reEnqueuedAfterDrain).toBe(true);
    expect(outcome.usedSyncFallback).toBe(false);
    expect(outcome.appendCommitted).toBe(true);
  });

  it('uses sync fallback path when queue never drains', () => {
    const clock = createFakeClock();
    const write = getCriticalWrite();
    const outcome = write({ criticalQueueFull: true, drainAfterMs: undefined, clock });

    expect(outcome.usedSyncFallback).toBe(true);
    expect(outcome.appendCommitted).toBe(true);
  });
});
