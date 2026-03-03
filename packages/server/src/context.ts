import type { LogEntry } from '@claw-insights/shared';

import { config } from './config.js';
import { getPorts, registerPorts } from './context/ports.js';
import type { Database } from './db/database.js';
import { initDatabase } from './db/init.js';
import { MessageEventBus } from './events/message-event-bus.js';
import { TokenEventBus } from './events/token-event-bus.js';
import { createChildLogger } from './logger.js';
import { Pipeline } from './pipeline/index.js';
import { loadPlatform } from './platforms/index.js';
import type { TypedPorts } from './ports/index.js';
import { Aggregator } from './sources/aggregator.js';
import { createLogIngester } from './sources/collectors/log/ingester.js';
import { LogTailer } from './sources/collectors/log/tailer.js';
import { SystemSampler } from './sources/collectors/metrics/collector.js';
import { createTranscriptManager, type TranscriptManager } from './sources/collectors/transcript/index.js';
import { DataRetention } from './sources/data-retention.js';
import { DataValidator } from './sources/data-validator.js';
import { createGatewayClient, type GatewayClient } from './sources/gateway-cli.js';
import { CronReader } from './sources/readers/cron-reader.js';
import { SessionReader } from './sources/readers/session-reader.js';
import { SpawnTracker } from './sources/readers/spawn-tracker.js';
import { createSystemInfoService, type SystemInfoService } from './sources/system-info.js';

const log = createChildLogger('context');

export interface AppContext {
  /** Typed port registry (Phase 1: sessions, metrics, gateway; Phase 2: cron, logs, system as undefined) */
  ports: TypedPorts;

  /**
   * @deprecated Use ctx.ports.* instead. Will be removed in v0.X.0
   * Migration: ctx.sessionReader → ctx.ports.sessions
   */
  db: Database;
  /**
   * @deprecated Direct pipeline access discouraged. Use ctx.ports for data access.
   */
  pipeline: Pipeline;
  /**
   * @deprecated Use ctx.ports.sessions instead. Will be removed in v0.X.0
   */
  sessionReader: SessionReader;
  /**
   * @deprecated Use ctx.ports.cron instead (Phase 2). Will be removed in v0.X.0
   */
  cronReader: CronReader;
  /**
   * @deprecated Use ctx.ports.logs instead (Phase 2). Will be removed in v0.X.0
   */
  logTailer: LogTailer;
  /** @deprecated Internal component. Will be removed in v0.X.0 */
  spawnTracker: SpawnTracker;
  /**
   * @deprecated Use ctx.ports.metrics instead. Will be removed in v0.X.0
   */
  aggregator: Aggregator;
  /** @deprecated Internal service. Will be removed in v0.X.0 */
  systemSampler: SystemSampler;
  /** @deprecated Internal service. Will be removed in v0.X.0 */
  dataValidator: DataValidator;
  /** @deprecated Internal service. Will be removed in v0.X.0 */
  dataRetention: DataRetention;
  /** @deprecated Internal component. Will be removed in v0.X.0 */
  lifetimeScanner: TranscriptManager;
  /** Destroyed flag (not deprecated) */
  destroyed: boolean;
  /** @deprecated Internal event bus. Will be removed in v0.X.0 */
  tokenBus: TokenEventBus;
  /** @deprecated Internal event bus. Will be removed in v0.X.0 */
  messageBus: MessageEventBus;
  /**
   * @deprecated Use ctx.ports.gateway instead. Will be removed in v0.X.0
   */
  gatewayClient: GatewayClient;
  /**
   * @deprecated Use ctx.ports.system instead (Phase 2). Will be removed in v0.X.0
   */
  systemInfoService: SystemInfoService;
}

export async function createContext(): Promise<AppContext> {
  log.info('createContext started');
  const platform = await loadPlatform();
  const gatewayClient = createGatewayClient(platform);
  const systemInfoService = createSystemInfoService(platform);

  const db = initDatabase({ dbPath: config.dbPath });
  const sessionReader = new SessionReader(config.sessionsPath);
  sessionReader.setDb(db);
  const cronReader = new CronReader(config.cronPath);
  const logTailer = new LogTailer(config.logDir);
  const spawnTracker = new SpawnTracker();
  const aggregator = new Aggregator(db);

  const tokenBus = new TokenEventBus();
  const messageBus = new MessageEventBus();

  const systemSampler = new SystemSampler(db, sessionReader, () => systemInfoService.getSystemMetrics(), aggregator);

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

  const transcriptManager = createTranscriptManager({
    db,
    transcriptsDir: config.transcriptsDir,
    deviceJsonPath: config.deviceJsonPath,
    tokenBus,
    messageBus,
    onFlush: (flushedMessages) => {
      if (flushedMessages > 0) {
        sessionReader.invalidateTurnCounts();
      }
    },
  });

  const ingestLog = createLogIngester(db);

  const pipeline = new Pipeline()
    // Sources — emit events
    .addSource('logTailer', logTailer)
    // Managed — lifecycle-only resources (no events, just destroy)
    .addManaged('tokenBus', { destroy: () => tokenBus.destroy() })
    .addManaged('messageBus', { destroy: () => messageBus.destroy() })
    .addManaged('sessionReader', sessionReader)
    .addManaged('cronReader', cronReader)
    // Processors — handle events
    .addProcessor('logIngester', (e: unknown) => {
      ingestLog(e as LogEntry);
    })
    .addProcessor('spawnTracker', {
      handle: (entry: unknown) => {
        spawnTracker.ingest(entry as LogEntry);
      },
    })
    // Services — background lifecycle
    .addService('systemSampler', systemSampler)
    .addService('dataValidator', dataValidator)
    .addService('dataRetention', dataRetention)
    .addManaged('lifetimeScanner', transcriptManager);

  // Register ports (Phase 1: sessions, metrics, gateway)
  registerPorts(pipeline, {
    sessionReader,
    aggregator,
    gatewayClient,
  });

  // Build pipeline
  pipeline
    // Wiring — declarative data flow
    .wire('logTailer', 'log', ['logIngester', 'spawnTracker'])
    .build();

  // Assemble typed ports from pipeline
  const ports = getPorts(pipeline);

  log.info('createContext complete');

  return {
    // New typed ports interface
    ports,

    // Legacy fields (marked @deprecated in interface)
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
    lifetimeScanner: transcriptManager,
    destroyed: false,
    tokenBus,
    messageBus,
    gatewayClient,
    systemInfoService,
  };
}

export function startContext(ctx: AppContext): void {
  log.info('startContext: starting pipeline');
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Internal implementation needs direct access
  ctx.pipeline.start();
  // eslint-disable-next-line @typescript-eslint/no-deprecated -- Internal implementation needs direct access
  void ctx.lifetimeScanner
    .init()
    .then(() => {
      if (ctx.destroyed) {
        return;
      }

      // Warm gateway cache after scanner completes — avoids event-loop
      // contention that caused false 'gateway down' on startup (ISS-056)
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- Internal implementation needs direct access
      ctx.gatewayClient.warmCache().catch((err: unknown) => {
        log.debug({ err }, 'warmCache failed (non-fatal)');
      });
    })
    .catch((err: unknown) => {
      log.error({ err }, 'lifetime scanner init failed');
    });
}

export async function destroyContext(ctx: AppContext): Promise<void> {
  log.info('destroyContext started');
  ctx.destroyed = true;

  try {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Internal implementation needs direct access
    await ctx.pipeline.destroy();
  } finally {
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- Internal implementation needs direct access
    ctx.db.close();
  }
}
