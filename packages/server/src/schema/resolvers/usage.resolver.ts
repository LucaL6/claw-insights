import type { AppContext } from '../../context.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';
import { safe } from './utils.js';

export function usageResolvers(ctx: AppContext): Partial<Resolvers> {
  const { logTailer } = ctx;

  const usageCost: QueryResolvers['usageCost'] = () => safe(async () => ctx.systemInfoService.getUsageCost());

  const recentLogs: QueryResolvers['recentLogs'] = (_parent, args) => logTailer.getRecentEntries(args.count ?? 50);

  return { Query: { usageCost, recentLogs } };
}
