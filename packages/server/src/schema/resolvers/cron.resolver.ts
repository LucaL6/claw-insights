/* eslint-disable @typescript-eslint/no-deprecated -- Phase 2: legacy ctx.* refs not yet migrated to ports */
import type { AppContext } from '../../context.js';
import { createChildLogger } from '../../logger.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';

const log = createChildLogger('resolver:cron');

export function cronResolvers(ctx: AppContext): Partial<Resolvers> {
  const cronJobs: QueryResolvers['cronJobs'] = () => {
    const start = performance.now();
    const result = ctx.cronReader.getJobs();
    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: cronJobs');
    }
    return result;
  };
  return { Query: { cronJobs } };
}
