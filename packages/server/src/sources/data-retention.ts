import type { DatabaseSync as Database } from 'node:sqlite';

import { createChildLogger } from '../logger.js';

const log = createChildLogger('data-retention');

export interface RetentionConfig {
  rawRetentionDays: number; // 0 = permanent
  hourlyRetention: string; // 'permanent' | number (days)
  aggregateIntervalMs: number;
}

export class DataRetention {
  private timer: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  constructor(
    private db: Database,
    private config: RetentionConfig,
  ) {}

  start() {
    this.runOnce();
    this.timer = setInterval(() => {
      this.runOnce();
    }, this.config.aggregateIntervalMs);
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = null;
  }

  /** Run aggregation + pruning (public for testing). Guarded against reentrant calls. */
  runOnce() {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    try {
      this.aggregate();
      this.prune();
    } finally {
      this.isRunning = false;
    }
  }

  private aggregate() {
    const currentHourStart = new Date();
    currentHourStart.setMinutes(0, 0, 0);
    const cutoff = currentHourStart.toISOString();

    const hours = this.db
      .prepare(
        `
      SELECT DISTINCT strftime('%Y-%m-%dT%H:00:00Z', timestamp) AS hour
      FROM system_samples
      WHERE timestamp < ?
        AND strftime('%Y-%m-%dT%H:00:00Z', timestamp) NOT IN (SELECT hour FROM hourly_system_samples)
      ORDER BY hour
    `,
      )
      .all(cutoff) as { hour: string }[];

    if (hours.length === 0) {
      return;
    }

    this.db.exec('BEGIN');
    try {
      for (const { hour } of hours) {
        this.aggregateHour(hour);
      }
      this.db.exec('COMMIT');
      log.info({ hours: hours.length }, 'aggregated hours');
    } catch (err) {
      this.db.exec('ROLLBACK');
      log.error({ err }, 'aggregation failed');
    }
  }

  private aggregateHour(hour: string) {
    const nextHour = new Date(new Date(hour).getTime() + 60 * 60 * 1000)
      .toISOString()
      .replace(/:\d{2}\.\d{3}Z/, ':00:00Z');

    const agg = this.db
      .prepare(
        `
      SELECT
        MAX(active_sessions) AS active_sessions_max,
        AVG(active_sessions) AS active_sessions_avg,
        MAX(cpu) AS cpu_max,
        AVG(cpu) AS cpu_avg,
        AVG(memory_mb) AS memory_mb_avg,
        MAX(memory_mb) AS memory_mb_max,
        COUNT(*) AS sample_count
      FROM system_samples
      WHERE timestamp >= ? AND timestamp < ?
    `,
      )
      .get(hour, nextHour) as Record<string, number>;

    this.db
      .prepare(
        `
      INSERT OR IGNORE INTO hourly_system_samples (hour, active_sessions_max, active_sessions_avg, cpu_avg, cpu_max, memory_mb_avg, memory_mb_max, sample_count)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .run(
        hour,
        agg.active_sessions_max ?? 0,
        agg.active_sessions_avg ?? 0,
        agg.cpu_avg ?? 0,
        agg.cpu_max ?? 0,
        agg.memory_mb_avg ?? 0,
        agg.memory_mb_max ?? 0,
        agg.sample_count ?? 0,
      );
  }

  private prune() {
    if (this.config.rawRetentionDays > 0) {
      const rawCutoff = new Date(Date.now() - this.config.rawRetentionDays * 24 * 60 * 60 * 1000).toISOString();

      this.db
        .prepare(
          `
        DELETE FROM system_samples
        WHERE timestamp < ?
          AND strftime('%Y-%m-%dT%H:00:00Z', timestamp) IN (SELECT hour FROM hourly_system_samples)
      `,
        )
        .run(rawCutoff);

      this.db.prepare('DELETE FROM token_usage_events WHERE timestamp < ?').run(rawCutoff);
    }

    if (this.config.hourlyRetention !== 'permanent') {
      const days = parseInt(this.config.hourlyRetention, 10);
      if (Number.isFinite(days) && days > 0) {
        const hourlyCutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
        this.db.prepare('DELETE FROM hourly_system_samples WHERE hour < ?').run(hourlyCutoff);
      }
    }
  }
}
