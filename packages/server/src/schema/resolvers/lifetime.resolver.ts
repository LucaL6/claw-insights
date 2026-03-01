import type { AppContext } from '../../context.js';
import { createChildLogger } from '../../logger.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';
import { safe } from './utils.js';

const log = createChildLogger('resolver:lifetime');

export function lifetimeResolvers(ctx: AppContext): Partial<Resolvers> {
  const lifetimeStats: QueryResolvers['lifetimeStats'] = async () => {
    const start = performance.now();
    const result = await safe(async () => ctx.lifetimeScanner.getStats());
    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: lifetimeStats');
    }
    return result;
  };

  return { Query: { lifetimeStats } };
}
