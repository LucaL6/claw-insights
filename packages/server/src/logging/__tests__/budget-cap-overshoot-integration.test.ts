import { describe, expect, it } from 'vitest';

import { BudgetGate } from '../budget-gate.js';

describe('budget cap overshoot integration', () => {
  it('keeps max overshoot within 5% of global cap', () => {
    const gate = new BudgetGate({
      globalCapMb: 1024,
      errorFloorMb: 300,
      errorReserveMb: 50,
      appSoftMb: 500,
      debugSoftMb: 200,
    });

    gate.setUsage('app', 500 * 1024 * 1024);
    gate.setUsage('debug', 200 * 1024 * 1024);
    gate.setUsage('error', 300 * 1024 * 1024);

    const accepted = gate.checkAppend('error', 50 * 1024 * 1024);
    expect(accepted).toBe(false);

    const state = gate.state() as unknown as { maxOvershootMb?: number };
    const maxOvershootMb = typeof state.maxOvershootMb === 'number' ? state.maxOvershootMb : Number.POSITIVE_INFINITY;

    expect(maxOvershootMb).toBeLessThanOrEqual(1024 * 1.05);
  });
});
