import type { LogEntry } from '@claw-insights/shared';
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
import { Pipeline } from './pipeline/index.js';
import type { DatabaseSync } from 'node:sqlite';

export interface AppContext {
  db: DatabaseSync;
  pipeline: Pipeline;
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

  const pipeline = new Pipeline()
    // Sources — emit events
    .addSource('logTailer', logTailer)
    // Managed — lifecycle-only resources (no events, just destroy)
    .addManaged('sessionReader', sessionReader)
    .addManaged('cronReader', cronReader)
    // Processors — handle events
    .addProcessor('logIngester', createLogIngester(db))
    .addProcessor('spawnTracker', { handle: (entry: unknown) => spawnTracker.ingest(entry as LogEntry) })
    // Services — background lifecycle
    .addService('metricsCollector', metricsCollector)
    .addService('dataValidator', dataValidator)
    .addService('dataRetention', dataRetention)
    // Wiring — declarative data flow
    .wire('logTailer', 'log', ['logIngester', 'spawnTracker'])
    .build();

  return {
    db,
    pipeline,
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
  ctx.pipeline.start();
}

export function destroyContext(ctx: AppContext): void {
  ctx.pipeline.destroy();
  if (typeof (ctx.db as unknown as { close?: () => void }).close === 'function') {
    (ctx.db as unknown as { close(): void }).close();
  }
}
