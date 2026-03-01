import type { AppContext } from '../../context.js';
import { createChildLogger } from '../../logger.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';
import { safe } from './utils.js';

const log = createChildLogger('resolver:usage');

export function usageResolvers(ctx: AppContext): Partial<Resolvers> {
  const { logTailer } = ctx;

  const usageCost: QueryResolvers['usageCost'] = async () => {
    const start = performance.now();
    const result = await safe(async () => ctx.systemInfoService.getUsageCost());
    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: usageCost');
    }
    return result;
  };

  const recentLogs: QueryResolvers['recentLogs'] = (_parent, args) => {
    const start = performance.now();
    const result = logTailer.getRecentEntries(args.count ?? 50);
    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: recentLogs');
    }
    return result;
  };

  return { Query: { usageCost, recentLogs } };
}
