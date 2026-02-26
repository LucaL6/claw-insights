export interface ConnectionSnapshot {
  readonly sseHealthy: boolean;
  readonly everConnected: boolean;
  readonly isOffline: boolean;
  readonly lastSuccessTs: number;
}

type Listener = () => void;

export class ConnectionHealthStore {
  private _sseMap = new Map<string, boolean>();
  private _lastSuccessTs = 0;
  private _everConnected = false;
  private _isOffline = false;
  private _listeners = new Set<Listener>();
  private _cachedSnapshot: ConnectionSnapshot | null = null;
  private _graceTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly _graceMs: number;

  constructor(graceMs = 15_000) {
    this._graceMs = graceMs;
  }

  reportSseHealth(source: string, healthy: boolean): void {
    const prev = this._sseMap.get(source);
    if (prev === healthy) {
      return;
    }

    const oldAgg = this._computeSseHealthy();
    this._sseMap.set(source, healthy);
    const newAgg = this._computeSseHealthy();

    if (healthy) {
      const changed = this._recover();
      if (oldAgg !== newAgg || changed) {
        this._invalidate();
      }
    } else {
      this._maybeScheduleGrace();
      if (oldAgg !== newAgg) {
        this._invalidate();
      }
    }
  }

  unregisterSse(source: string): void {
    if (!this._sseMap.has(source)) {
      return;
    }
    const oldAgg = this._computeSseHealthy();
    this._sseMap.delete(source);
    const newAgg = this._computeSseHealthy();
    if (!newAgg) {
      this._maybeScheduleGrace();
    }
    if (oldAgg !== newAgg) {
      this._invalidate();
    }
  }

  reportFetchSuccess(): void {
    this._lastSuccessTs = Date.now();
    const wasOffline = this._isOffline;
    const wasConnected = this._everConnected;
    this._everConnected = true;
    this._recover();
    if (!wasConnected || wasOffline) {
      this._invalidate();
    }
  }

  reportFetchFailure(): void {
    this._maybeScheduleGrace();
  }

  getSnapshot(): ConnectionSnapshot {
    if (this._cachedSnapshot) {
      return this._cachedSnapshot;
    }
    this._cachedSnapshot = {
      sseHealthy: this._computeSseHealthy(),
      everConnected: this._everConnected,
      isOffline: this._isOffline,
      lastSuccessTs: this._lastSuccessTs,
    };
    return this._cachedSnapshot;
  }

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  destroy(): void {
    this._clearGraceTimer();
    this._listeners.clear();
  }

  private _computeSseHealthy(): boolean {
    if (this._sseMap.size === 0) {
      return true;
    }
    return [...this._sseMap.values()].some(Boolean);
  }

  private _recover(): boolean {
    const wasOffline = this._isOffline;
    this._isOffline = false;
    this._clearGraceTimer();
    return wasOffline;
  }

  private _invalidate(): void {
    this._cachedSnapshot = null;
    for (const l of this._listeners) {
      l();
    }
  }

  private _maybeScheduleGrace(): void {
    if (this._isOffline) {
      return;
    }
    if (this._computeSseHealthy()) {
      return;
    }
    if (!this._everConnected) {
      return;
    }

    this._clearGraceTimer();

    const deadline = this._lastSuccessTs + this._graceMs;
    const delay = Math.max(0, deadline - Date.now());

    this._graceTimer = setTimeout(() => {
      this._graceTimer = null;
      this._isOffline = true;
      this._invalidate();
    }, delay);
  }

  private _clearGraceTimer(): void {
    if (this._graceTimer) {
      clearTimeout(this._graceTimer);
      this._graceTimer = null;
    }
  }
}

export const connectionHealth = new ConnectionHealthStore();
