import type { DatabaseSync as Database } from 'node:sqlite';
import { insertSample, insertModelSample } from '../../db/metric-queries.js';
import { emitChange } from '../../events.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('metrics-collector');

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
  private prevTotalTokensK: number | null = null;
  private prevModelTokensK = new Map<string, number>();

  constructor(
    private db: Database,
    private sessionReader: SessionReaderLike,
    private getSystemMetrics: () => SystemMetricsResult | Promise<SystemMetricsResult>,
    private getUsageCost: () => UsageCostResult | Promise<UsageCostResult>,
    private aggregator?: { clearCache(): void },
    private fastIntervalMs: number = 30_000,
    private slowIntervalMs: number = 120_000,
  ) {}

  /** Fast sample: sessions + tokens (every 30s) */
  sampleFast() {
    const sessions = this.sessionReader.getSessions();
    const activeSessions = sessions.filter((s) => s.status === 'ACTIVE').length;

    // Use full token data (bypasses dedup filter)
    const tokensByModel = this.sessionReader.getTokensByModel();
    const totalTokensK = this.sessionReader.getTotalTokensK();

    // Compute global delta (clamp to 0 on cumulative reset)
    let tokenDeltaK = 0;
    if (this.prevTotalTokensK !== null && totalTokensK >= this.prevTotalTokensK) {
      tokenDeltaK = totalTokensK - this.prevTotalTokensK;
    }
    this.prevTotalTokensK = totalTokensK;

    this.lastActiveSessions = activeSessions;
    this.lastTotalTokensK = totalTokensK;

    insertSample(this.db, {
      activeSessions,
      totalTokensK,
      tokenDeltaK,
      costToday: this.lastCostToday,
      tokensTodayM: this.lastTokensTodayM,
      cpu: this.lastCpu,
      memoryMb: this.lastMemoryMb,
    });

    // Write per-model samples
    for (const [model, tokens] of tokensByModel) {
      const tokensK = tokens / 1000;
      const prevK = this.prevModelTokensK.get(model);
      let modelDeltaK = 0;
      if (prevK !== undefined && tokensK >= prevK) {
        modelDeltaK = tokensK - prevK;
      }
      this.prevModelTokensK.set(model, tokensK);
      insertModelSample(this.db, { model, totalTokensK: tokensK, tokenDeltaK: modelDeltaK });
    }

    // Prune models no longer present to prevent unbounded Map growth
    for (const key of this.prevModelTokensK.keys()) {
      if (!tokensByModel.has(key)) {
        this.prevModelTokensK.delete(key);
      }
    }

    this.aggregator?.clearCache();
    emitChange('metrics');
  }

  /** Slow sample: cost + system metrics (every 2min) */
  async sampleSlow() {
    const cost = await this.getUsageCost();
    const sys = await this.getSystemMetrics();

    this.lastCostToday = cost.todayCost;
    this.lastTokensTodayM = cost.todayTokensM;
    this.lastCpu = sys.cpu;
    this.lastMemoryMb = sys.memoryMB;

    // Only write cost + system metrics, carry forward token values.
    // Note: totalTokensK here is the last value from sampleFast (at most 30s stale).
    // This is acceptable because SUM(delta) calculation tolerates minor staleness.
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

  start() {
    this.sampleFast();
    this.sampleSlow().catch((err) => log.warn({ err }, 'sampleSlow error'));
    this.fastTimer = setInterval(() => this.sampleFast(), this.fastIntervalMs);
    this.slowTimer = setInterval(() => {
      this.sampleSlow().catch((err) => log.warn({ err }, 'sampleSlow error'));
    }, this.slowIntervalMs);
  }

  stop() {
    if (this.fastTimer) clearInterval(this.fastTimer);
    if (this.slowTimer) clearInterval(this.slowTimer);
    this.fastTimer = null;
    this.slowTimer = null;
  }
}
