import type { Database } from '../../db/database.js';
import { insertSystemSample } from '../../db/system-queries.js';
import { emitChange } from '../../events.js';
import { createChildLogger } from '../../logger.js';

const log = createChildLogger('system-sampler');

export interface SessionLike {
  key: string;
  status: string;
}

export interface SessionReaderLike {
  getSessions(): SessionLike[];
}

interface SystemMetricsResult {
  cpu: number;
  memoryMB: number;
  diskMB: number;
  sampledAt: string;
}

export class SystemSampler {
  private fastTimer: ReturnType<typeof setInterval> | null = null;
  private slowTimer: ReturnType<typeof setInterval> | null = null;
  private lastCpu = 0;
  private lastMemoryMb = 0;

  constructor(
    private db: Database,
    private sessionReader: SessionReaderLike,
    private getSystemMetrics: () => SystemMetricsResult | Promise<SystemMetricsResult>,
    private aggregator?: { clearCache(): void },
    private fastIntervalMs: number = 30_000,
    private slowIntervalMs: number = 120_000,
  ) {}

  /** Fast sample: sessions (every 30s) */
  sampleFast() {
    const sessions = this.sessionReader.getSessions();
    const activeSessions = sessions.filter((s) => s.status === 'ACTIVE').length;

    insertSystemSample(this.db, {
      activeSessions,
      cpu: this.lastCpu,
      memoryMb: this.lastMemoryMb,
    });

    this.aggregator?.clearCache();
    emitChange('metrics');
  }

  /** Slow sample: system metrics (every 2min) */
  async sampleSlow() {
    const sys = await this.getSystemMetrics();
    this.lastCpu = sys.cpu;
    this.lastMemoryMb = sys.memoryMB;
  }

  start() {
    this.sampleFast();
    this.sampleSlow().catch((err) => {
      log.warn({ err }, 'sampleSlow error');
    });
    this.fastTimer = setInterval(() => {
      this.sampleFast();
    }, this.fastIntervalMs);
    this.slowTimer = setInterval(() => {
      this.sampleSlow().catch((err) => {
        log.warn({ err }, 'sampleSlow error');
      });
    }, this.slowIntervalMs);
  }

  stop() {
    if (this.fastTimer) {
      clearInterval(this.fastTimer);
    }
    if (this.slowTimer) {
      clearInterval(this.slowTimer);
    }
    this.fastTimer = null;
    this.slowTimer = null;
  }
}
