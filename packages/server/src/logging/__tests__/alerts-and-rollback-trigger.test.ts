import { describe, expect, it } from 'vitest';

import { LoggingRuntimeState } from '../state.js';

describe('alerts and rollback trigger', () => {
  it('triggers rollback when dropped-error condition persists for 30s', () => {
    const state = new LoggingRuntimeState();

    state.incrementDropped('error');
    state.snapshot(0);

    state.incrementDropped('error');
    state.snapshot(15_000);

    state.incrementDropped('error');
    state.snapshot(31_000);

    const health = state.healthStatus();
    expect(health.health).toBe('critical');
    expect(health.rollbackTriggered).toBe(true);
    expect(health.alert).toBe('critical-dropped-error-persisted');
  });

  it('does not trigger rollback for a transient single dropped-error event', () => {
    const state = new LoggingRuntimeState();

    state.incrementDropped('error');
    state.snapshot(0);
    state.snapshot(31_000);

    const health = state.healthStatus();
    expect(health.rollbackTriggered).toBe(false);
  });
});
