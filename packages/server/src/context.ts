import type { DatabaseSync } from 'node:sqlite';

import type { LogEntry } from '@claw-insights/shared';

import { config } from './config.js';
import { initDatabase } from './db/init.js';
import { deleteAllMessageEvents, insertMessageEventBatch } from './db/message-queries.js';
import { insertTokenUsageEventBatch } from './db/token-queries.js';
import { type MessageEvent, MessageEventBus } from './events/message-event-bus.js';
import type { TokenUsageEvent } from './events/token-event-bus.js';
import { TokenEventBus } from './events/token-event-bus.js';
import { Pipeline } from './pipeline/index.js';
import { Aggregator } from './sources/aggregator.js';
import { LifetimeScanner } from './sources/collectors/lifetime-scanner.js';
import { createLogIngester } from './sources/collectors/log-ingester.js';
import { LogTailer } from './sources/collectors/log-tailer.js';
import { SystemSampler } from './sources/collectors/metrics-collector.js';
import { DataRetention } from './sources/data-retention.js';
import { DataValidator } from './sources/data-validator.js';
import { CronReader } from './sources/readers/cron-reader.js';
import { SessionReader } from './sources/readers/session-reader.js';
import { SpawnTracker } from './sources/readers/spawn-tracker.js';
import { getSystemMetrics } from './sources/system-info.js';

export interface AppContext {
  db: DatabaseSync;
  pipeline: Pipeline;
  sessionReader: SessionReader;
  cronReader: CronReader;
  logTailer: LogTailer;
  spawnTracker: SpawnTracker;
  aggregator: Aggregator;
  systemSampler: SystemSampler;
  dataValidator: DataValidator;
  dataRetention: DataRetention;
  lifetimeScanner: LifetimeScanner;
  flushTokenEvents: () => void;
  flushMessageEvents: () => void;
}

export function createContext(): AppContext {
  const db = initDatabase(config.dbPath);
  const sessionReader = new SessionReader(config.sessionsPath);
  sessionReader.setDb(db);
  const cronReader = new CronReader(config.cronPath);
  const logTailer = new LogTailer(config.logDir);
  const spawnTracker = new SpawnTracker();
  const aggregator = new Aggregator(db);

  const tokenBus = new TokenEventBus();
  const messageBus = new MessageEventBus();
  const BATCH_SIZE = 100;

  let tokenEventBuffer: TokenUsageEvent[] = [];
  const flushTokenEvents = () => {
    if (tokenEventBuffer.length > 0) {
      insertTokenUsageEventBatch(db, tokenEventBuffer);
      tokenEventBuffer = [];
    }
  };
  tokenBus.on((event) => {
    tokenEventBuffer.push(event);
    if (tokenEventBuffer.length >= BATCH_SIZE) {
      flushTokenEvents();
    }
  });

  let messageEventBuffer: MessageEvent[] = [];
  const flushMessageEvents = () => {
    if (messageEventBuffer.length > 0) {
      insertMessageEventBatch(db, messageEventBuffer);
      sessionReader.invalidateTurnCounts();
      messageEventBuffer = [];
    }
  };
  messageBus.on((event) => {
    messageEventBuffer.push(event);
    if (messageEventBuffer.length >= BATCH_SIZE) {
      flushMessageEvents();
    }
  });

  const systemSampler = new SystemSampler(db, sessionReader, () => getSystemMetrics(), aggregator);

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

  const lifetimeScanner = new LifetimeScanner(
    config.transcriptsDir,
    config.deviceJsonPath,
    tokenBus,
    messageBus,
    () => {
      deleteAllMessageEvents(db);
      messageEventBuffer = [];
    },
  );

  const pipeline = new Pipeline()
    // Sources — emit events
    .addSource('logTailer', logTailer)
    // Managed — lifecycle-only resources (no events, just destroy)
    .addManaged('tokenBus', { destroy: () => tokenBus.destroy() })
    .addManaged('messageBus', { destroy: () => messageBus.destroy() })
    .addManaged('sessionReader', sessionReader)
    .addManaged('cronReader', cronReader)
    // Processors — handle events
    .addProcessor('logIngester', createLogIngester(db))
    .addProcessor('spawnTracker', {
      handle: (entry: unknown) => {
        spawnTracker.ingest(entry as LogEntry);
      },
    })
    // Services — background lifecycle
    .addService('systemSampler', systemSampler)
    .addService('dataValidator', dataValidator)
    .addService('dataRetention', dataRetention)
    .addManaged('lifetimeScanner', lifetimeScanner)
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
    systemSampler,
    dataValidator,
    dataRetention,
    lifetimeScanner,
    flushTokenEvents,
    flushMessageEvents,
  };
}

export function startContext(ctx: AppContext): void {
  ctx.pipeline.start();
  ctx.lifetimeScanner
    .init()
    .then(() => {
      ctx.flushTokenEvents();
      ctx.flushMessageEvents();
    })
    .catch((err: unknown) => {
      console.error('lifetime scanner init failed:', err);
    });
}

export function destroyContext(ctx: AppContext): void {
  ctx.flushTokenEvents();
  ctx.flushMessageEvents();
  ctx.pipeline.destroy();
  if (typeof (ctx.db as unknown as { close?: () => void }).close === 'function') {
    (ctx.db as unknown as { close(): void }).close();
  }
}
