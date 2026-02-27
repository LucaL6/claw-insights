import type { AppContext } from '../../context.js';
import type { MetricsSummary,QueryResolvers, Resolvers } from '../generated/resolver-types.js';

const VALID_RANGES = new Set(['THIRTY_MIN', 'ONE_HOUR', 'SIX_HOUR', 'TWELVE_HOUR', 'TWENTY_FOUR_HOUR']);

export function metricsResolvers(ctx: AppContext): Partial<Resolvers> {
  const { aggregator, dataValidator } = ctx;

  const metrics: QueryResolvers['metrics'] = (_parent, args) => {
    const range = VALID_RANGES.has(args.range ?? '') ? args.range : 'TWENTY_FOUR_HOUR';
    const m = aggregator.getMetrics(
      args.date ?? undefined,
      (range as 'TWENTY_FOUR_HOUR') ?? 'TWENTY_FOUR_HOUR',
    ) as Record<string, unknown>;
    const validationResults = dataValidator.runValidation();
    const warnings = validationResults.filter((r) => !r.pass).map((r) => r.message);
    return { ...m, warnings } as MetricsSummary;
  };

  return { Query: { metrics } };
}
