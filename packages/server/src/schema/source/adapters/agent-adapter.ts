import { GraphQLError } from 'graphql';

import { createReadContext } from '../../../context/read-context.js';
import type { Database } from '../../../db/database.js';
import type { TypedPorts } from '../../../ports/index.js';
import type { MetricsRangeKey } from '../../../ports/metrics-port.js';
import { readTranscript } from '../../../sources/readers/transcript-reader.js';
import type { SourceAdapter } from '../registry.js';
import type { SourceEntry } from '../selector.js';

interface EventsFns {
  queryEvents: (db: Database, opts: { from?: number; to?: number; types?: string[]; limit?: number }) => unknown;
  getEventDensity: (db: Database) => unknown;
  getEventCounts: (db: Database, opts: { from?: number; to?: number }) => unknown;
}

interface ValidationResultLike {
  pass: boolean;
  message: string;
}

interface AgentAdapterDeps {
  runValidation?: () => ValidationResultLike[];
}

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

const VALID_METRICS_RANGES = new Set<MetricsRangeKey>([
  'THIRTY_MIN',
  'ONE_HOUR',
  'SIX_HOUR',
  'TWELVE_HOUR',
  'TWENTY_FOUR_HOUR',
]);

const VALID_LOG_LEVELS = new Set<LogLevel>(['DEBUG', 'INFO', 'WARN', 'ERROR']);

const normalizeMetricsRange = (range: unknown): MetricsRangeKey => {
  const candidate = typeof range === 'string' ? range : '';
  if (VALID_METRICS_RANGES.has(candidate as MetricsRangeKey)) {
    return candidate as MetricsRangeKey;
  }
  return 'TWENTY_FOUR_HOUR';
};

const normalizeLogLevel = (level: string): LogLevel => {
  const upper = level.toUpperCase() as LogLevel;
  if (VALID_LOG_LEVELS.has(upper)) {
    return upper;
  }
  return 'INFO';
};

const mapTranscriptReadError = (err: unknown): GraphQLError => {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes('File too large')) {
    return new GraphQLError('Transcript file too large', {
      extensions: { code: 'TRANSCRIPT_TOO_LARGE' },
    });
  }

  return new GraphQLError('Failed to read transcript', {
    extensions: { code: 'TRANSCRIPT_READ_ERROR' },
  });
};

export const createAgentAdapter = (
  id: string,
  name: string,
  ports: TypedPorts,
  eventsFns: EventsFns,
  db: Database | null,
  deps: AgentAdapterDeps = {},
): SourceAdapter => {
  const info: SourceEntry = {
    id,
    name,
    status: 'CONNECTED',
    attributes: { category: 'AGENT', provider: 'OPENCLAW', tags: [] },
  };

  const resolvers: SourceAdapter['resolvers'] = {
    sessions: (args) => {
      const readCtx = createReadContext();
      const rawFilter = args.filter as Record<string, unknown> | undefined;
      const filter = rawFilter
        ? {
            activeOnly: (rawFilter.activeOnly as boolean | undefined) ?? undefined,
            sortBy: (rawFilter.sortBy as 'UPDATED_AT' | 'TOKENS_DESC' | 'NAME' | undefined) ?? undefined,
          }
        : undefined;
      return ports.sessions.getSessions(filter, readCtx);
    },

    metrics: (args) => {
      const readCtx = createReadContext();
      const m = ports.metrics.getMetrics(
        (args.date as string | undefined) ?? undefined,
        normalizeMetricsRange(args.range),
        readCtx,
      );

      const validationResults = deps.runValidation?.() ?? null;
      const warnings: string[] = validationResults
        ? validationResults.filter((r) => !r.pass).map((r) => r.message)
        : [];

      return { ...m, warnings };
    },

    recentLogs: (args) => {
      const readCtx = createReadContext();
      const entries = ports.logs.getRecentLogs((args.count as number | undefined) ?? 50, readCtx);
      return entries.map((e: { timestamp: number; level: string; source: string; message: string }) => ({
        time: new Date(e.timestamp).toISOString(),
        level: normalizeLogLevel(e.level),
        module: e.source,
        message: e.message,
      }));
    },

    cronJobs: () => {
      const readCtx = createReadContext();
      const entries = ports.cron.getCronJobs(readCtx);
      return entries.map(
        (e: {
          id: string;
          description?: string;
          enabled: boolean;
          schedule: string;
          lastRun: number | null;
          nextRun: number | null;
        }) => ({
          id: e.id,
          name: e.description ?? null,
          enabled: e.enabled,
          schedule: e.schedule,
          lastRunAt: e.lastRun ? new Date(e.lastRun).toISOString() : null,
          lastRunSuccess: null,
          nextRunAt: e.nextRun ? new Date(e.nextRun).toISOString() : null,
        }),
      );
    },

    usageCost: () => {
      const readCtx = createReadContext();
      return ports.usage.getUsageCost(readCtx);
    },

    lifetimeStats: () => {
      const readCtx = createReadContext();
      return ports.lifetime.getStats(readCtx);
    },

    sessionTranscript: async (args) => {
      const readCtx = createReadContext();
      const sessionKey = args.sessionKey as string;
      const filePath = ports.transcript.getTranscriptPath(sessionKey, readCtx);
      if (!filePath) {
        return null;
      }

      if (args.before && args.after) {
        throw new GraphQLError('Cannot specify both before and after', {
          extensions: { code: 'BAD_USER_INPUT' },
        });
      }

      try {
        return await readTranscript(filePath, sessionKey, {
          limit: (args.limit as number | undefined) ?? undefined,
          before: (args.before as string | undefined) ?? undefined,
          after: (args.after as string | undefined) ?? undefined,
        });
      } catch (err) {
        throw mapTranscriptReadError(err);
      }
    },

    events: (args) => {
      if (!db) {
        return { events: [], total: 0, counts: { error: 0, warning: 0, restart: 0 } };
      }
      return eventsFns.queryEvents(db, {
        from: (args.from as number | undefined) ?? undefined,
        to: (args.to as number | undefined) ?? undefined,
        types: (args.types as string[] | undefined) ?? undefined,
        limit: (args.limit as number | undefined) ?? undefined,
      });
    },

    eventDensity: () => {
      if (!db) {
        return [];
      }
      return eventsFns.getEventDensity(db);
    },

    eventCounts: (args) => {
      if (!db) {
        return { error: 0, warning: 0, restart: 0 };
      }
      return eventsFns.getEventCounts(db, {
        from: (args.from as number | undefined) ?? undefined,
        to: (args.to as number | undefined) ?? undefined,
      });
    },
  };

  return { info, resolvers };
};
