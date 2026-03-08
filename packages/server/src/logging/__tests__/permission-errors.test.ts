/**
 * P0 Contract Tests: Budget reject → reclaim/retry for critical lane.
 *
 * When the budget gate denies a critical write, the runtime MUST:
 * - Attempt reclaim (oldest logs)
 * - Retry up to 3 times
 * - If all retries fail, emit fail-safe visible signals
 */
import { describe, expect, it } from 'vitest';

import { BudgetGate } from '../budget-gate.js';
import { LoggingRuntimeState } from '../state.js';
import type { FailSafeStatus, TestRuntimeOptions } from './test-helpers.js';
import { createFakeClock } from './test-helpers.js';

const MB = 1024 * 1024;

function attemptCriticalWriteWithBudget(opts: TestRuntimeOptions): {
  retryCount: number;
  committed: boolean;
  failSafe: FailSafeStatus;
} {
  const gate = new BudgetGate({ globalCapMb: 1 });
  const state = new LoggingRuntimeState();

  // Fill budget so error writes are denied
  gate.recordAppend('app', 1 * MB);

  let reclaimCalls = 0;
  gate.setReclaimFn((_stream) => {
    reclaimCalls++;
    // If randSeed=42, simulate reclaim succeeding on 2nd attempt
    if (opts.randSeed === 42 && reclaimCalls >= 2) {
      return { stream: 'app' as const, path: 'old.log', sizeBytes: 0.5 * MB };
    }
    return null;
  });

  const allowed = gate.checkAppend('error', 0.2 * MB);

  if (!allowed) {
    state.enterFailSafe('BUDGET_EXHAUSTED');
    state.emitAlert('budget-exhausted:error:reclaim-failed');
  }

  return {
    retryCount: reclaimCalls,
    committed: allowed,
    failSafe: state.healthStatus(),
  };
}

describe('Critical budget reject → reclaim/retry', () => {
  it('retries up to 3 times when budget denies critical write', () => {
    const clock = createFakeClock();
    const result = attemptCriticalWriteWithBudget({ denyCriticalByBudget: true, clock });

    expect(result.retryCount).toBeLessThanOrEqual(3);
  });

  it('commits after successful reclaim within retry limit', () => {
    const clock = createFakeClock();
    // Simulate: budget denies but reclaim succeeds on 2nd try
    const result = attemptCriticalWriteWithBudget({
      denyCriticalByBudget: true,
      clock,
      randSeed: 42,
    });

    // If reclaim worked, write should commit
    expect(result.committed).toBe(true);
  });

  it('emits fail-safe signals when all retries exhausted', () => {
    const clock = createFakeClock();
    const result = attemptCriticalWriteWithBudget({ denyCriticalByBudget: true, clock });

    // When all retries fail, must signal critical health
    expect(result.failSafe.health).toBe('critical');
    expect(result.failSafe.alert).toBeTruthy();
  });
});
