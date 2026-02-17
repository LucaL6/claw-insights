import { config } from './config.js';
import { SessionReader } from './sources/session-reader.js';
import { CronReader } from './sources/cron-reader.js';
import { SystemMetrics } from './sources/system-metrics.js';
import { LogTailer } from './sources/log-tailer.js';
import { SpawnTracker } from './sources/spawn-tracker.js';
import { Aggregator } from './sources/aggregator.js';
import { MetricsCollector } from './sources/metrics-collector.js';
import { DataValidator } from './sources/data-validator.js';
import { DataRetention } from './sources/data-retention.js';
import { getUsageCost } from './sources/usage-cost.js';
import { initDatabase } from './db/init.js';
import type { DatabaseSync } from 'node:sqlite';

export interface AppContext {
  db: DatabaseSync;
  sessionReader: SessionReader;
  cronReader: CronReader;
  systemMetrics: SystemMetrics;
  logTailer: LogTailer;
  spawnTracker: SpawnTracker;
  aggregator: Aggregator;
  metricsCollector: MetricsCollector;
  dataValidator: DataValidator;
  dataRetention: DataRetention;
}

export function createContext(): AppContext {
  const db = initDatabase(config.dbPath);
  const sessionReader = new SessionReader(config.sessionsPath);
  const cronReader = new CronReader(config.cronPath);
  const systemMetrics = new SystemMetrics();
  const logTailer = new LogTailer(config.logDir);
  const spawnTracker = new SpawnTracker();
  const aggregator = new Aggregator(db);

  const metricsCollector = new MetricsCollector(
    db,
    sessionReader,
    () => systemMetrics.getMetrics(),
    () => getUsageCost(),
    aggregator,
  );

  const dataValidator = new DataValidator(
    db,
    () => (aggregator.getMetrics() as { totalTokensK: number }).totalTokensK,
    () => 0,
  );

  const dataRetention = new DataRetention(db, {
    rawRetentionDays: config.rawRetentionDays,
    hourlyRetention: config.hourlyRetention,
    aggregateIntervalMs: config.aggregateIntervalMs,
  });

  // Wire log events to aggregator + spawn tracker
  logTailer.on('log', (entry) => {
    aggregator.ingestLog(entry);
    spawnTracker.ingest(entry);
  });

  return { db, sessionReader, cronReader, systemMetrics, logTailer, spawnTracker, aggregator, metricsCollector, dataValidator, dataRetention };
}

export function startContext(ctx: AppContext): void {
  ctx.metricsCollector.start();
  ctx.dataValidator.start();
  ctx.dataRetention.start();
}

export function destroyContext(ctx: AppContext): void {
  ctx.sessionReader.destroy();
  ctx.logTailer.destroy();
  ctx.cronReader.destroy();
  ctx.metricsCollector.stop();
  ctx.dataValidator.stop();
  ctx.dataRetention.stop();
  if (typeof (ctx.db as any).close === 'function') {
    (ctx.db as any).close();
  }
}
