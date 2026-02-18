import { config } from './config.js';
import { SessionReader } from './sources/readers/session-reader.js';
import { CronReader } from './sources/readers/cron-reader.js';
import { SpawnTracker } from './sources/readers/spawn-tracker.js';
import { LogTailer } from './sources/collectors/log-tailer.js';
import { createLogIngester } from './sources/collectors/log-ingester.js';
import { MetricsCollector } from './sources/collectors/metrics-collector.js';
import { Aggregator } from './sources/aggregator.js';
import { DataValidator } from './sources/data-validator.js';
import { DataRetention } from './sources/data-retention.js';
import { getSystemMetrics, getUsageCost } from './sources/system-info.js';
import { initDatabase } from './db/init.js';
import type { DatabaseSync } from 'node:sqlite';

export interface AppContext {
  db: DatabaseSync;
  sessionReader: SessionReader;
  cronReader: CronReader;
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
  const logTailer = new LogTailer(config.logDir);
  const spawnTracker = new SpawnTracker();
  const aggregator = new Aggregator(db);

  const metricsCollector = new MetricsCollector(
    db,
    sessionReader,
    () => getSystemMetrics(),
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

  // Wire log events to ingester + spawn tracker
  const ingestLog = createLogIngester(db);
  logTailer.on('log', (entry) => {
    ingestLog(entry);
    spawnTracker.ingest(entry);
  });

  return {
    db,
    sessionReader,
    cronReader,
    logTailer,
    spawnTracker,
    aggregator,
    metricsCollector,
    dataValidator,
    dataRetention,
  };
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
