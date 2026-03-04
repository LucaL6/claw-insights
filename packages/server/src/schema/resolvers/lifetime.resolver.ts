import { GraphQLError } from 'graphql';

import type { AppContext } from '../../context.js';
import { createReadContext } from '../../context/read-context.js';
import { createChildLogger } from '../../logger.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';

const log = createChildLogger('resolver:lifetime');

export function lifetimeResolvers(ctx: AppContext): Partial<Resolvers> {
  const lifetimeStats: QueryResolvers['lifetimeStats'] = () => {
    const start = performance.now();
    const readCtx = createReadContext();
    try {
      const result = ctx.ports.lifetime.getStats(readCtx);
      const ms = performance.now() - start;
      if (ms > 100) {
        log.debug({ ms: Math.round(ms) }, 'slow resolve: lifetimeStats');
      }
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Internal server error';
      log.error({ err }, message);
      throw new GraphQLError(message, {
        extensions: { code: 'INTERNAL_SERVER_ERROR' },
      });
    }
  };

  return { Query: { lifetimeStats } };
}
