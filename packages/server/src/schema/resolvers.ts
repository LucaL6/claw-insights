import { Repeater } from 'graphql-yoga';
import { dataBus } from '../events.js';
import type { DataChangeEvent } from '../events.js';
import { SessionReader } from '../sources/session-reader.js';
import { CronReader } from '../sources/cron-reader.js';
import { SystemMetrics } from '../sources/system-metrics.js';
import { LogTailer } from '../sources/log-tailer.js';
import { SpawnTracker } from '../sources/spawn-tracker.js';
import { initDatabase } from '../db/init.js';
import { queryEvents, getEventDensity } from '../db/queries.js';
import { Aggregator } from '../sources/aggregator.js';
import { getGatewayStatus } from '../sources/gateway-cli.js';
import { getUsageCost } from '../sources/usage-cost.js';
import { DataValidator } from '../sources/data-validator.js';
import { MetricsCollector } from '../sources/metrics-collector.js';

const sessionReader = new SessionReader();
const cronReader = new CronReader();
const systemMetrics = new SystemMetrics();
const logTailer = new LogTailer();
const spawnTracker = new SpawnTracker();
const db = initDatabase();
const aggregator = new Aggregator(db);

const metricsCollector = new MetricsCollector(
  db,
  sessionReader,
  () => systemMetrics.getMetrics(),
  () => getUsageCost(),
  aggregator,
);
metricsCollector.start();

const dataValidator = new DataValidator(
  db,
  () => {
    const m = aggregator.getMetrics() as { totalTokensK: number };
    return m.totalTokensK;
  },
  () => 0, // Will be refined when status parsing provides token totals
);
dataValidator.start();

logTailer.on('log', (entry) => {
  aggregator.ingestLog(entry);
  spawnTracker.ingest(entry);
});

function gatewayShape() {
  const status = getGatewayStatus();
  return {
    running: status.running,
    pid: status.pid,
    version: status.version,
    updateAvailable: status.updateAvailable,
    uptime: status.uptime,
    startedAt: status.startedAt,
    connectLatencyMs: status.connectLatencyMs,
    latestVersion: status.latestVersion,
    securityCritical: status.securitySummary.critical,
    securityWarn: status.securitySummary.warn,
  };
}

export const resolvers = {
  Query: {
    gateway: () => gatewayShape(),
    resources: () => systemMetrics.getMetrics(),
    channels: () => {
      const status = getGatewayStatus();
      return status.channels;
    },
    sessions: (_: unknown, args: { filter?: { activeOnly?: boolean; sortBy?: string } }) => {
      sessionReader.attachSubAgents(spawnTracker.getParentChildMap());
      return sessionReader.getSessions(args.filter ?? undefined);
    },
    metrics: (_: unknown, args: { date?: string; range?: string }) => {
      const m = aggregator.getMetrics(args.date, (args.range as 'TWENTY_FOUR_HOUR') ?? 'TWENTY_FOUR_HOUR') as Record<string, unknown>;
      const validationResults = dataValidator.runValidation();
      const warnings = validationResults.filter(r => !r.pass).map(r => r.message);
      return { ...m, warnings };
    },
    cronJobs: () => cronReader.getJobs(),
    usageCost: () => getUsageCost(),
    recentLogs: (_: unknown, args: { count?: number }) => logTailer.getRecentEntries(args.count ?? 50),
    events: (_: unknown, args: { from?: number; to?: number; types?: string[]; limit?: number }) => {
      return queryEvents(db, { from: args.from, to: args.to, types: args.types, limit: args.limit });
    },
    eventDensity: () => getEventDensity(db),
  },

  Subscription: {
    logs: {
      subscribe: (_: unknown, args: { filter?: { level?: string; module?: string } }) =>
        new Repeater(async (push, stop) => {
          const handler = (e: { level: string; module: string; time: string; message: string }) => {
            if (args.filter?.level) {
              const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
              if (levels.indexOf(e.level) < levels.indexOf(args.filter.level)) return;
            }
            if (args.filter?.module && e.module !== args.filter.module) return;
            push({ logs: { entries: [e], counts: { debug: 0, info: 0, warn: 0, error: 0 } } });
          };
          logTailer.on('log', handler);
          stop.then(() => logTailer.off('log', handler));
        }),
    },
    dataChanged: {
      subscribe: () =>
        new Repeater(async (push, stop) => {
          const handler = (event: DataChangeEvent) => {
            push({ dataChanged: event });
          };
          dataBus.on('change', handler);
          stop.then(() => dataBus.off('change', handler));
        }),
    },
  },

  Mutation: {
    restartGateway: () => ({ success: true, message: 'Not implemented yet', output: '', duration: 0 }),
    runDoctor: () => ({ success: true, message: 'Not implemented yet', output: '', duration: 0 }),
    updateGateway: () => ({ success: true, message: 'Not implemented yet', output: '', duration: 0 }),
  },
};
