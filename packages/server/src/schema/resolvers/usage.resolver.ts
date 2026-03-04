import type { LogEntry as SharedLogEntry, LogLevel } from '@claw-insights/shared';

import type { AppContext } from '../../context.js';
import { createReadContext } from '../../context/read-context.js';
import { createChildLogger } from '../../logger.js';
import type { LogEntry as PortLogEntry } from '../../ports/log-port.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';
import { safe } from './utils.js';

const log = createChildLogger('resolver:usage');

const VALID_LOG_LEVELS = new Set<LogLevel>(['DEBUG', 'INFO', 'WARN', 'ERROR']);

/**
 * Validate and normalize log level to GraphQL LogLevel.
 * Falls back to 'INFO' if level is unknown.
 */
function normalizeLogLevel(level: string): LogLevel {
  const upper = level.toUpperCase();
  if (VALID_LOG_LEVELS.has(upper as LogLevel)) {
    return upper as LogLevel;
  }
  return 'INFO';
}

/**
 * Map port LogEntry to GraphQL LogEntry.
 */
function mapLogEntryToGraphQL(entry: PortLogEntry): SharedLogEntry {
  return {
    time: new Date(entry.timestamp).toISOString(),
    level: normalizeLogLevel(entry.level),
    module: entry.source,
    message: entry.message,
  };
}

export function usageResolvers(ctx: AppContext): Partial<Resolvers> {
  const usageCost: QueryResolvers['usageCost'] = async () => {
    const start = performance.now();
    const readCtx = createReadContext();
    const result = await safe(() => ctx.ports.usage.getUsageCost(readCtx));
    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: usageCost');
    }
    return result;
  };

  const recentLogs: QueryResolvers['recentLogs'] = (_parent, args) => {
    const start = performance.now();
    const readCtx = createReadContext();

    const entries = ctx.ports.logs.getRecentLogs(args.count ?? 50, readCtx);
    const result = entries.map(mapLogEntryToGraphQL);

    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: recentLogs');
    }
    return result;
  };

  return { Query: { usageCost, recentLogs } };
}
