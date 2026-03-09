import type { LogStream } from './types.js';

export interface BudgetConfig {
  globalCapMb: number;
  errorFloorMb: number;
  errorReserveMb: number;
  appSoftMb: number;
  debugSoftMb: number;
  noiseSoftMb: number;
}

export const DEFAULT_BUDGET_CONFIG: BudgetConfig = {
  globalCapMb: 1024,
  errorFloorMb: 300,
  errorReserveMb: 50,
  appSoftMb: 500,
  debugSoftMb: 200,
  noiseSoftMb: 200,
};

export interface BudgetState {
  usedByStream: Record<LogStream, number>;
  totalUsed: number;
  freeSpaceMb: number;
  maxOvershootMb: number;
}

export interface ReclaimCandidate {
  stream: LogStream;
  path: string;
  sizeBytes: number;
}

export type ReclaimFn = (stream: LogStream) => ReclaimCandidate | null;

export interface BudgetHealthStatus {
  health: 'ok' | 'degraded' | 'critical';
  alert: string | null;
}

export class BudgetGate {
  private readonly config: BudgetConfig;
  private readonly usedBytes: Record<LogStream, number> = { app: 0, error: 0, debug: 0, noise: 0, security: 0 };
  private reclaimFn: ReclaimFn | null = null;
  private _healthStatus: BudgetHealthStatus = { health: 'ok', alert: null };
  private maxOvershootBytes = 0;

  constructor(config: Partial<BudgetConfig> = {}) {
    this.config = { ...DEFAULT_BUDGET_CONFIG, ...config };
  }

  setReclaimFn(fn: ReclaimFn): void {
    this.reclaimFn = fn;
  }

  /** Record bytes added to a stream. */
  recordAppend(stream: LogStream, bytes: number): void {
    this.usedBytes[stream] += bytes;
  }

  /** Record bytes removed (after reclaim/deletion). */
  recordRemoval(stream: LogStream, bytes: number): void {
    this.usedBytes[stream] = Math.max(0, this.usedBytes[stream] - bytes);
  }

  /** Set usage directly (e.g. after scanning disk). */
  setUsage(stream: LogStream, bytes: number): void {
    this.usedBytes[stream] = bytes;
  }

  state(): BudgetState {
    const totalUsed =
      this.usedBytes.app + this.usedBytes.error + this.usedBytes.debug + this.usedBytes.noise + this.usedBytes.security;
    const capBytes = this.config.globalCapMb * 1024 * 1024;
    return {
      usedByStream: { ...this.usedBytes },
      totalUsed,
      freeSpaceMb: Math.max(0, (capBytes - totalUsed) / (1024 * 1024)),
      maxOvershootMb: this.maxOvershootBytes / (1024 * 1024),
    };
  }

  healthStatus(): BudgetHealthStatus {
    return { ...this._healthStatus };
  }

  /**
   * Check if an append of `bytes` to `stream` is allowed.
   * For critical streams (error/security), attempts up to 3 reclaim/retry cycles.
   * Returns true if the append can proceed.
   */
  checkAppend(stream: LogStream, bytes: number): boolean {
    const isCritical = stream === 'error' || stream === 'security';
    const maxRetries = isCritical ? 3 : 1;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (this.canFit(stream, bytes)) {
        return true;
      }
      if (!this.reclaimOnce(stream)) {
        if (isCritical) {
          this._healthStatus = { health: 'critical', alert: `budget-exhausted:${stream}:reclaim-failed` };
        }
        return false;
      }
    }

    const fits = this.canFit(stream, bytes);
    if (!fits && isCritical) {
      this._healthStatus = { health: 'critical', alert: `budget-exhausted:${stream}:retries-exhausted` };
    }
    return fits;
  }

  private canFit(stream: LogStream, bytes: number): boolean {
    const capBytes = this.config.globalCapMb * 1024 * 1024;
    const totalAfter = this.totalUsed() + bytes;

    // Global cap check.
    if (totalAfter > capBytes) {
      this.maxOvershootBytes = Math.max(this.maxOvershootBytes, totalAfter - capBytes);
      return false;
    }

    // Per-stream soft cap checks.
    const streamAfter = this.usedBytes[stream] + bytes;
    if (stream === 'app' && streamAfter > this.config.appSoftMb * 1024 * 1024) {
      return false;
    }
    if (stream === 'debug' && streamAfter > this.config.debugSoftMb * 1024 * 1024) {
      return false;
    }
    if (stream === 'noise' && streamAfter > this.config.noiseSoftMb * 1024 * 1024) {
      return false;
    }

    // Error reserve: ensure critical streams have headroom.
    const MB = 1024 * 1024;
    const reservedForCriticalBytes = (this.config.errorFloorMb + this.config.errorReserveMb) * MB;
    const criticalUsageBytes = this.usedBytes.error + this.usedBytes.security;
    const criticalHeadroomBytes = Math.max(0, this.config.globalCapMb * MB - criticalUsageBytes);
    if (stream !== 'error' && stream !== 'security' && criticalHeadroomBytes < reservedForCriticalBytes) {
      return false;
    }

    return true;
  }

  /**
   * Attempt to reclaim space. Order: oldest debug first, then oldest app.
   * Returns true if space was freed.
   */
  private reclaimOnce(_requestingStream: LogStream): boolean {
    if (!this.reclaimFn) {
      return false;
    }

    // Try debug first, then app.
    const reclaimOrder: LogStream[] = ['debug', 'noise', 'app'];
    for (const target of reclaimOrder) {
      const candidate = this.reclaimFn(target);
      if (candidate) {
        this.recordRemoval(candidate.stream, candidate.sizeBytes);
        return true;
      }
    }
    return false;
  }

  private totalUsed(): number {
    return (
      this.usedBytes.app + this.usedBytes.error + this.usedBytes.debug + this.usedBytes.noise + this.usedBytes.security
    );
  }
}
