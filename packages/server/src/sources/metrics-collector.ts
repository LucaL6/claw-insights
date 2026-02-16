import type { Database } from 'bun:sqlite';
import { insertSample, insertModelSample } from '../db/queries.js';
import { emitChange } from '../events.js';

interface SessionLike {
  key: string;
  status: string;
  totalTokens: number;
}

interface SessionReaderLike {
  getSessions(): SessionLike[];
  getTokensByModel(): Map<string, number>;
  getTotalTokensK(): number;
}

interface SystemMetricsResult {
  cpu: number;
  memoryMB: number;
  diskMB: number;
  sampledAt: string;
}

interface UsageCostResult {
  totalCost: number;
  totalTokensM: number;
  todayCost: number;
  todayTokensM: number;
  fetchedAt: string;
}

export class MetricsCollector {
  private fastTimer: ReturnType<typeof setInterval> | null = null;
  private slowTimer: ReturnType<typeof setInterval> | null = null;
  private lastActiveSessions = 0;
  private lastTotalTokensK = 0;
  private lastCostToday = 0;
  private lastTokensTodayM = 0;
  private lastCpu = 0;
  private lastMemoryMb = 0;

  constructor(
    private db: Database,
    private sessionReader: SessionReaderLike,
    private getSystemMetrics: () => SystemMetricsResult,
    private getUsageCost: () => UsageCostResult,
    private aggregator?: { clearCache(): void },
    private fastIntervalMs: number = 30_000,
    private slowIntervalMs: number = 120_000,
  ) {}

  /** Fast sample: sessions + tokens (every 30s) */
  sampleFast() {
    const sessions = this.sessionReader.getSessions();
    const activeSessions = sessions.filter(s => s.status === 'ACTIVE').length;

    // Use full token data (bypasses dedup filter)
    const tokensByModel = this.sessionReader.getTokensByModel();
    const totalTokensK = this.sessionReader.getTotalTokensK();

    this.lastActiveSessions = activeSessions;
    this.lastTotalTokensK = totalTokensK;

    // Write global sample (no delta — computed at query time via MAX-MIN)
    insertSample(this.db, {
      activeSessions,
      totalTokensK,
      tokenDeltaK: 0,
      costToday: this.lastCostToday,
      tokensTodayM: this.lastTokensTodayM,
      cpu: this.lastCpu,
      memoryMb: this.lastMemoryMb,
    });

    // Write per-model samples
    for (const [model, tokens] of tokensByModel) {
      insertModelSample(this.db, {
        model,
        totalTokensK: tokens / 1000,
      });
    }

    this.aggregator?.clearCache();
    emitChange('metrics');
  }

  /** Slow sample: cost + system metrics (every 2min) */
  sampleSlow() {
    const cost = this.getUsageCost();
    const sys = this.getSystemMetrics();

    this.lastCostToday = cost.todayCost;
    this.lastTokensTodayM = cost.todayTokensM;
    this.lastCpu = sys.cpu;
    this.lastMemoryMb = sys.memoryMB;

    // Only write cost + system metrics, carry forward token values.
    // Note: totalTokensK here is the last value from sampleFast (at most 30s stale).
    // This is acceptable because MAX-MIN delta calculation tolerates minor staleness.
    insertSample(this.db, {
      activeSessions: this.lastActiveSessions,
      totalTokensK: this.lastTotalTokensK,
      tokenDeltaK: 0,
      costToday: cost.todayCost,
      tokensTodayM: cost.todayTokensM,
      cpu: sys.cpu,
      memoryMb: sys.memoryMB,
    });

    this.aggregator?.clearCache();
    emitChange('metrics');
  }

  /** Prune old samples older than 48h */
  private pruneOldSamples() {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    this.db.prepare('DELETE FROM model_token_samples WHERE timestamp < ?').run(cutoff);
    this.db.prepare('DELETE FROM metric_samples WHERE timestamp < ?').run(cutoff);
  }

  start() {
    this.sampleFast();
    this.sampleSlow();
    this.fastTimer = setInterval(() => this.sampleFast(), this.fastIntervalMs);
    this.slowTimer = setInterval(() => this.sampleSlow(), this.slowIntervalMs);
    // Prune on startup and every 6 hours
    this.pruneOldSamples();
    setInterval(() => this.pruneOldSamples(), 6 * 60 * 60 * 1000);
  }

  stop() {
    if (this.fastTimer) clearInterval(this.fastTimer);
    if (this.slowTimer) clearInterval(this.slowTimer);
    this.fastTimer = null;
    this.slowTimer = null;
  }
}
