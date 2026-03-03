/* eslint-disable @typescript-eslint/no-deprecated -- Phase 2: dataValidator not yet migrated */
import type { AppContext } from '../../context.js';
import { createReadContext } from '../../context/read-context.js';
import { createChildLogger } from '../../logger.js';
import type { MetricsRangeKey } from '../../ports/metrics-port.js';
import type { MetricsSummary, QueryResolvers, Resolvers } from '../generated/resolver-types.js';

const log = createChildLogger('resolver:metrics');

const VALID_RANGES = new Set(['THIRTY_MIN', 'ONE_HOUR', 'SIX_HOUR', 'TWELVE_HOUR', 'TWENTY_FOUR_HOUR']);

export function metricsResolvers(ctx: AppContext): Partial<Resolvers> {
  const { dataValidator } = ctx;

  const metrics: QueryResolvers['metrics'] = (_parent, args) => {
    const start = performance.now();
    const readCtx = createReadContext();

    const range = VALID_RANGES.has(args.range ?? '') ? args.range : 'TWENTY_FOUR_HOUR';

    const m = ctx.ports.metrics.getMetrics(
      args.date ?? undefined,
      (range as MetricsRangeKey) ?? 'TWENTY_FOUR_HOUR',
      readCtx,
    ) as Record<string, unknown>;

    const validationResults = dataValidator.runValidation();
    const warnings = validationResults.filter((r) => !r.pass).map((r) => r.message);
    const result = { ...m, warnings } as MetricsSummary;

    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: metrics');
    }
    return result;
  };

  return { Query: { metrics } };
}
