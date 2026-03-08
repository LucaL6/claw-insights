import type { PressureSignals, PressureState } from './types.js';

export interface PressureThresholds {
  normalToPressure: {
    queueUsageCriticalPct: number;
    ioLagMs: number;
    budgetUsagePct: number;
    holdMs: number;
  };
  pressureToEmergency: {
    queueUsageCriticalPct: number;
    freeSpaceMb: number;
    budgetUsagePct: number;
    holdMs: number;
  };
  recoverToNormal: {
    queueUsageCriticalPct: number;
    ioLagMs: number;
    budgetUsagePct: number;
    holdMs: number;
  };
}

export const DEFAULT_PRESSURE_THRESHOLDS: PressureThresholds = {
  normalToPressure: {
    queueUsageCriticalPct: 70,
    ioLagMs: 200,
    budgetUsagePct: 85,
    holdMs: 10_000,
  },
  pressureToEmergency: {
    queueUsageCriticalPct: 90,
    freeSpaceMb: 200,
    budgetUsagePct: 95,
    holdMs: 30_000,
  },
  recoverToNormal: {
    queueUsageCriticalPct: 40,
    ioLagMs: 100,
    budgetUsagePct: 80,
    holdMs: 60_000,
  },
};

interface BreachTimers {
  normalToPressureSince: number | null;
  pressureToEmergencySince: number | null;
  recoverySince: number | null;
}

export const FLAPPING_THRESHOLD = 3;
export const FLAPPING_WINDOW_MS = 3_600_000; // 1 hour

export interface PressureStateSnapshot {
  state: PressureState;
  transitions: number;
  lastTransitionAt: number | null;
  flapping: boolean;
}

export class PressureStateMachine {
  private state: PressureState;

  private transitions = 0;

  private lastTransitionAt: number | null = null;

  private transitionTimestamps: number[] = [];

  private timers: BreachTimers = {
    normalToPressureSince: null,
    pressureToEmergencySince: null,
    recoverySince: null,
  };

  private readonly thresholds: PressureThresholds;

  constructor(initialState: PressureState = 'normal', thresholds: PressureThresholds = DEFAULT_PRESSURE_THRESHOLDS) {
    this.state = initialState;
    this.thresholds = thresholds;
  }

  getState(): PressureState {
    return this.state;
  }

  getSnapshot(): PressureStateSnapshot {
    return {
      state: this.state,
      transitions: this.transitions,
      lastTransitionAt: this.lastTransitionAt,
      flapping: this.isFlapping(),
    };
  }

  isFlapping(): boolean {
    if (this.transitionTimestamps.length <= FLAPPING_THRESHOLD) {return false;}
    const cutoff = this.transitionTimestamps[this.transitionTimestamps.length - 1] - FLAPPING_WINDOW_MS;
    const recentCount = this.transitionTimestamps.filter((t) => t > cutoff).length;
    return recentCount > FLAPPING_THRESHOLD;
  }

  evaluate(signals: PressureSignals, nowMs: number = Date.now()): PressureState {
    const shouldEscalateToPressure =
      signals.queueUsageCriticalPct > this.thresholds.normalToPressure.queueUsageCriticalPct ||
      signals.ioLagMs > this.thresholds.normalToPressure.ioLagMs ||
      signals.budgetUsagePct > this.thresholds.normalToPressure.budgetUsagePct;

    const shouldEscalateToEmergency =
      signals.queueUsageCriticalPct > this.thresholds.pressureToEmergency.queueUsageCriticalPct ||
      signals.freeSpaceMb < this.thresholds.pressureToEmergency.freeSpaceMb ||
      signals.budgetUsagePct > this.thresholds.pressureToEmergency.budgetUsagePct;

    const isHealthy =
      signals.queueUsageCriticalPct < this.thresholds.recoverToNormal.queueUsageCriticalPct &&
      signals.ioLagMs < this.thresholds.recoverToNormal.ioLagMs &&
      signals.budgetUsagePct < this.thresholds.recoverToNormal.budgetUsagePct;

    if (this.state === 'normal') {
      if (
        this.isHeld('normalToPressureSince', shouldEscalateToPressure, nowMs, this.thresholds.normalToPressure.holdMs)
      ) {
        this.transitionTo('pressure', nowMs);
      }
      this.timers.pressureToEmergencySince = null;
      this.timers.recoverySince = null;
      return this.state;
    }

    if (this.state === 'pressure') {
      if (
        this.isHeld(
          'pressureToEmergencySince',
          shouldEscalateToEmergency,
          nowMs,
          this.thresholds.pressureToEmergency.holdMs,
        )
      ) {
        this.transitionTo('emergency', nowMs);
        this.timers.normalToPressureSince = null;
        this.timers.recoverySince = null;
        return this.state;
      }

      if (this.isHeld('recoverySince', isHealthy, nowMs, this.thresholds.recoverToNormal.holdMs)) {
        this.transitionTo('normal', nowMs);
        this.timers.normalToPressureSince = null;
        this.timers.pressureToEmergencySince = null;
      }

      return this.state;
    }

    if (this.isHeld('recoverySince', isHealthy, nowMs, this.thresholds.recoverToNormal.holdMs)) {
      this.transitionTo('normal', nowMs);
      this.timers.normalToPressureSince = null;
      this.timers.pressureToEmergencySince = null;
      return this.state;
    }

    this.timers.normalToPressureSince = null;
    this.timers.pressureToEmergencySince = null;
    return this.state;
  }

  private isHeld(timerKey: keyof BreachTimers, condition: boolean, nowMs: number, holdMs: number): boolean {
    if (!condition) {
      this.timers[timerKey] = null;
      return false;
    }

    const since = this.timers[timerKey];
    if (since === null) {
      this.timers[timerKey] = nowMs;
      return false;
    }

    return nowMs - since >= holdMs;
  }

  private transitionTo(nextState: PressureState, nowMs: number): void {
    if (nextState === this.state) {
      return;
    }

    this.state = nextState;
    this.transitions += 1;
    this.lastTransitionAt = nowMs;
    this.transitionTimestamps.push(nowMs);
  }
}
