import { PressureStateMachine } from './pressure.js';
import type { DropCounters, LoggingHealthSnapshot, PressureSignals, PressureState, QueueMetrics } from './types.js';

export interface RuntimeHealthStatus {
  health: 'ok' | 'degraded' | 'critical';
  alert: string | null;
  rollbackTriggered: boolean;
}

function createZeroDropCounters(): DropCounters {
  return {
    debug: 0,
    info: 0,
    warn: 0,
    error: 0,
  };
}

function createZeroQueueMetrics(): QueueMetrics {
  return {
    criticalDepth: 0,
    criticalCapacity: 1,
    bestEffortDepth: 0,
    bestEffortCapacity: 1,
  };
}

function defaultSignals(): PressureSignals {
  return {
    queueUsageCriticalPct: 0,
    ioLagMs: 0,
    budgetUsagePct: 0,
    freeSpaceMb: Number.POSITIVE_INFINITY,
  };
}

export class LoggingRuntimeState {
  private readonly dropCounters: DropCounters = createZeroDropCounters();

  private queue: QueueMetrics = createZeroQueueMetrics();

  private accepted = 0;

  private dropped = 0;

  private signals: PressureSignals = defaultSignals();

  private readonly pressure = new PressureStateMachine();

  private observedErrorDrops = 0;
  private errorDropWindowStartAt: number | null = null;
  private lastErrorDropObservedAt: number | null = null;

  private _health: 'ok' | 'degraded' | 'critical' = 'ok';
  private _alert: string | null = null;
  private _rollbackTriggered = false;

  incrementAccepted(count = 1): void {
    this.accepted += Math.max(0, count);
  }

  incrementDropped(level: keyof DropCounters, count = 1): void {
    const bounded = Math.max(0, count);
    this.dropCounters[level] += bounded;
    this.dropped += bounded;
  }

  updateQueue(partial: Partial<QueueMetrics>): void {
    this.queue = {
      ...this.queue,
      ...partial,
    };
  }

  updateSignals(partial: Partial<PressureSignals>): void {
    this.signals = {
      ...this.signals,
      ...partial,
    };
  }

  enterPressureState(state: PressureState, _reason: string): void {
    if (state === 'emergency') {this._health = 'critical';}
    else if (state === 'pressure') {this._health = this._health === 'critical' ? 'critical' : 'degraded';}
  }

  enterFailSafe(errno: string): void {
    this._health = 'critical';
    this._alert = `critical-write-failure:${errno}`;
  }

  emitAlert(alertString: string): void {
    this._alert = alertString;
  }

  triggerRollback(_reason: string): void {
    this._rollbackTriggered = true;
  }

  healthStatus(): RuntimeHealthStatus {
    return {
      health: this._health,
      alert: this._alert,
      rollbackTriggered: this._rollbackTriggered,
    };
  }

  evaluatePressure(nowMs: number = Date.now()): void {
    this.pressure.evaluate(this.deriveSignals(), nowMs);
    if (this.pressure.isFlapping()) {
      this.emitAlert('pressure-flapping');
    }
  }

  snapshot(nowMs: number = Date.now()): LoggingHealthSnapshot {
    this.applyDroppedErrorGuardrail(nowMs);

    const derived = this.deriveSignals();
    this.pressure.evaluate(derived, nowMs);

    const pressure = this.pressure.getSnapshot();

    return {
      ts: nowMs,
      pressureState: pressure.state,
      queue: { ...this.queue },
      drops: { ...this.dropCounters },
      totals: {
        accepted: this.accepted,
        dropped: this.dropped,
      },
      pressureTransitions: pressure.transitions,
      lastTransitionAt: pressure.lastTransitionAt,
      signals: { ...derived },
    };
  }

  private applyDroppedErrorGuardrail(nowMs: number): void {
    const totalErrorDrops = this.dropCounters.error;

    if (totalErrorDrops <= 0) {
      this.observedErrorDrops = 0;
      this.errorDropWindowStartAt = null;
      this.lastErrorDropObservedAt = null;
      return;
    }

    if (totalErrorDrops > this.observedErrorDrops) {
      const quietForMs =
        this.lastErrorDropObservedAt === null ? Number.POSITIVE_INFINITY : nowMs - this.lastErrorDropObservedAt;

      if (this.errorDropWindowStartAt === null || quietForMs > 30_000) {
        this.errorDropWindowStartAt = nowMs;
      }

      this.lastErrorDropObservedAt = nowMs;
      this.observedErrorDrops = totalErrorDrops;
    }

    if (this.errorDropWindowStartAt === null || this.lastErrorDropObservedAt === null) {
      return;
    }

    if (nowMs - this.lastErrorDropObservedAt > 30_000) {
      // The dropped-error condition is no longer continuous.
      this.errorDropWindowStartAt = null;
      this.lastErrorDropObservedAt = null;
      return;
    }

    if (nowMs - this.errorDropWindowStartAt >= 30_000) {
      this._health = 'critical';
      this._alert = 'critical-dropped-error-persisted';
      this._rollbackTriggered = true;
    }
  }

  private deriveSignals(): PressureSignals {
    const criticalCapacity = Math.max(1, this.queue.criticalCapacity);
    const queueUsageCriticalPct = (this.queue.criticalDepth / criticalCapacity) * 100;

    return {
      ...this.signals,
      queueUsageCriticalPct,
    };
  }
}
