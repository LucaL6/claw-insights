import type { CronJob } from '@claw-insights/shared';

import type { AppContext } from '../../context.js';
import { createReadContext } from '../../context/read-context.js';
import { createChildLogger } from '../../logger.js';
import type { CronEntry } from '../../ports/cron-port.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';

const log = createChildLogger('resolver:cron');

/**
 * Map CronEntry (port contract) to CronJob (GraphQL schema).
 */
function mapCronEntryToGraphQL(entry: CronEntry): CronJob {
  return {
    id: entry.id,
    name: entry.description ?? null,
    enabled: entry.enabled,
    schedule: entry.schedule,
    lastRunAt: entry.lastRun ? new Date(entry.lastRun).toISOString() : null,
    nextRunAt: entry.nextRun ? new Date(entry.nextRun).toISOString() : null,
    // Note: lastRunSuccess is not tracked in CronEntry port contract
    lastRunSuccess: null,
  };
}

export function cronResolvers(ctx: AppContext): Partial<Resolvers> {
  const cronJobs: QueryResolvers['cronJobs'] = () => {
    const start = performance.now();
    const readCtx = createReadContext();

    const entries = ctx.ports.cron.getCronJobs(readCtx);
    const result = entries.map(mapCronEntryToGraphQL);

    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: cronJobs');
    }
    return result;
  };
  return { Query: { cronJobs } };
}
