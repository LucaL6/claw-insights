import type { AppContext } from '../../context.js';
import { calculateCosts } from '../../sources/cost-calculator.js';
import { getCatalogResolver } from '../../sources/pricing-catalog.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';
import { safe } from './utils.js';

export function usageResolvers(ctx: AppContext): Partial<Resolvers> {
  const { logTailer, sessionReader } = ctx;

  const usageCost: QueryResolvers['usageCost'] = () => safe(async () => ctx.systemInfoService.getUsageCost());

  const costSummary: QueryResolvers['costSummary'] = () =>
    safe(async () => {
      const resolver = await getCatalogResolver();
      if (!resolver) {
        // Fallback: return CLI-based data shaped as CostSummary
        const cli = await ctx.systemInfoService.getUsageCost();
        return {
          totalUsd: cli.totalCost,
          inputUsd: 0,
          outputUsd: 0,
          byModel: [],
          fetchedAt: cli.fetchedAt,
          source: 'CLI_FALLBACK' as const,
        };
      }

      const sessions = sessionReader.getSessionTokenData();
      return calculateCosts(sessions, resolver);
    });

  const recentLogs: QueryResolvers['recentLogs'] = (_parent, args) => logTailer.getRecentEntries(args.count ?? 50);

  return { Query: { usageCost, costSummary, recentLogs } };
}
