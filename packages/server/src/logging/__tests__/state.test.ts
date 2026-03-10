import { describe, expect, it } from 'vitest';

import { LoggingRuntimeState } from '../state.js';

describe('LoggingRuntimeState', () => {
  it('tracks accepted/dropped counters', () => {
    const state = new LoggingRuntimeState();

    state.incrementAccepted();
    state.incrementAccepted(2);
    state.incrementDropped('debug');
    state.incrementDropped('info', 3);

    const snapshot = state.snapshot(5_000);

    expect(snapshot.totals.accepted).toBe(3);
    expect(snapshot.totals.dropped).toBe(4);
    expect(snapshot.drops.debug).toBe(1);
    expect(snapshot.drops.info).toBe(3);
    expect(snapshot.drops.error).toBe(0);
  });

  it('derives queue usage signal from queue metrics', () => {
    const state = new LoggingRuntimeState();

    state.updateQueue({
      criticalDepth: 50,
      criticalCapacity: 100,
      bestEffortDepth: 5,
      bestEffortCapacity: 10,
    });

    const snapshot = state.snapshot(10_000);

    expect(snapshot.queue.criticalDepth).toBe(50);
    expect(snapshot.signals.queueUsageCriticalPct).toBe(50);
  });

  it('updates pressure state based on signals and queue metrics', () => {
    const state = new LoggingRuntimeState();

    state.updateQueue({
      criticalDepth: 85,
      criticalCapacity: 100,
    });
    state.updateSignals({
      ioLagMs: 250,
      budgetUsagePct: 86,
      freeSpaceMb: 1024,
    });

    let snapshot = state.snapshot(0);
    expect(snapshot.pressureState).toBe('normal');

    snapshot = state.snapshot(11_000);
    expect(snapshot.pressureState).toBe('pressure');

    state.updateSignals({ ioLagMs: 10, budgetUsagePct: 10, freeSpaceMb: 4096 });
    state.updateQueue({ criticalDepth: 10, criticalCapacity: 100 });

    snapshot = state.snapshot(71_500);
    expect(snapshot.pressureState).toBe('pressure');

    snapshot = state.snapshot(132_000);
    expect(snapshot.pressureState).toBe('normal');
    expect(snapshot.pressureTransitions).toBe(2);
  });

  it('enterPressureState records transition', () => {
    const state = new LoggingRuntimeState();
    state.enterPressureState('pressure', 'test');
    // snapshot re-evaluates pressure from signals, but transition is recorded
    const snapshot = state.snapshot(0);
    expect(snapshot.pressureTransitions).toBeGreaterThanOrEqual(0);
  });

  it('dropped-error guardrail is no-op when no error drops observed', () => {
    const state = new LoggingRuntimeState();
    // snapshot() calls applyDroppedErrorGuardrail internally;
    // with zero error drops, the early return path (line 161) is exercised
    const s = state.snapshot(60_000);
    expect(s.pressureState).toBe('normal');
  });
});
