import { describe, expect, it } from 'vitest';

import { PressureStateMachine } from '../pressure.js';
import { LoggingRuntimeState } from '../state.js';
import type { PressureSignals } from '../types.js';

const healthy: PressureSignals = {
  queueUsageCriticalPct: 10,
  ioLagMs: 20,
  budgetUsagePct: 30,
  freeSpaceMb: 2048,
};

describe('PressureStateMachine', () => {
  it('enters pressure only after hold time', () => {
    const machine = new PressureStateMachine();
    const start = 1_000;

    const pressureSignals: PressureSignals = {
      ...healthy,
      ioLagMs: 300,
    };

    expect(machine.evaluate(pressureSignals, start)).toBe('normal');
    expect(machine.evaluate(pressureSignals, start + 9_000)).toBe('normal');
    expect(machine.evaluate(pressureSignals, start + 10_000)).toBe('pressure');
    expect(machine.evaluate(pressureSignals, start + 11_000)).toBe('pressure');
  });

  it('enters emergency from pressure after hold time', () => {
    const machine = new PressureStateMachine();

    const toPressure: PressureSignals = {
      ...healthy,
      budgetUsagePct: 90,
    };

    machine.evaluate(toPressure, 0);
    machine.evaluate(toPressure, 11_000);
    expect(machine.getState()).toBe('pressure');

    const emergencySignals: PressureSignals = {
      ...healthy,
      freeSpaceMb: 100,
    };

    expect(machine.evaluate(emergencySignals, 12_000)).toBe('pressure');
    expect(machine.evaluate(emergencySignals, 41_000)).toBe('pressure');
    expect(machine.evaluate(emergencySignals, 43_000)).toBe('emergency');
  });

  it('uses hysteresis to recover from emergency only after sustained healthy period', () => {
    const machine = new PressureStateMachine('emergency');

    expect(machine.evaluate(healthy, 0)).toBe('emergency');
    expect(machine.evaluate(healthy, 30_000)).toBe('emergency');
    expect(machine.evaluate(healthy, 61_000)).toBe('normal');

    const snapshot = machine.getSnapshot();
    expect(snapshot.transitions).toBe(1);
    expect(snapshot.lastTransitionAt).toBe(61_000);
  });

  it('detects flapping when transitions exceed threshold within window', () => {
    const machine = new PressureStateMachine();
    const pressureSignals: PressureSignals = { ...healthy, ioLagMs: 300 };
    const holdMs = 10_000;
    const recoveryHoldMs = 60_000;

    // Perform 4 transitions within 1 hour (normal→pressure→normal→pressure→normal)
    let t = 0;

    // Transition 1: normal → pressure
    machine.evaluate(pressureSignals, t);
    t += holdMs;
    machine.evaluate(pressureSignals, t);
    expect(machine.getState()).toBe('pressure');

    // Transition 2: pressure → normal (recovery)
    t += 1;
    machine.evaluate(healthy, t);
    t += recoveryHoldMs;
    machine.evaluate(healthy, t);
    expect(machine.getState()).toBe('normal');

    // Transition 3: normal → pressure
    t += 1;
    machine.evaluate(pressureSignals, t);
    t += holdMs;
    machine.evaluate(pressureSignals, t);
    expect(machine.getState()).toBe('pressure');
    expect(machine.isFlapping()).toBe(false); // only 3 transitions

    // Transition 4: pressure → normal
    t += 1;
    machine.evaluate(healthy, t);
    t += recoveryHoldMs;
    machine.evaluate(healthy, t);
    expect(machine.getState()).toBe('normal');
    expect(machine.isFlapping()).toBe(true); // 4 transitions within window
  });

  it('emits flapping alert when pressure transitions exceed 3 per hour', () => {
    const state = new LoggingRuntimeState();
    // Force rapid transitions via signals + evaluatePressure
    const pressureSignals: Partial<PressureSignals> = { ioLagMs: 300 };
    const holdMs = 10_000;
    const recoveryHoldMs = 60_000;

    let t = 0;

    // Transition 1: normal → pressure
    state.updateSignals(pressureSignals);
    state.evaluatePressure(t);
    t += holdMs;
    state.evaluatePressure(t);

    // Transition 2: pressure → normal
    t += 1;
    state.updateSignals({ ioLagMs: 10 });
    state.evaluatePressure(t);
    t += recoveryHoldMs;
    state.evaluatePressure(t);

    // Transition 3: normal → pressure
    t += 1;
    state.updateSignals(pressureSignals);
    state.evaluatePressure(t);
    t += holdMs;
    state.evaluatePressure(t);

    // Transition 4: pressure → normal → triggers flapping
    t += 1;
    state.updateSignals({ ioLagMs: 10 });
    state.evaluatePressure(t);
    t += recoveryHoldMs;
    state.evaluatePressure(t);

    const status = state.healthStatus();
    expect(status.alert).toBe('pressure-flapping');
  });
});
