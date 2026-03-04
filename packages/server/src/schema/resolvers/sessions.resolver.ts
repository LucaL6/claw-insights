import type { AppContext } from '../../context.js';
import { createReadContext } from '../../context/read-context.js';
import { createChildLogger } from '../../logger.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';

const log = createChildLogger('resolver:sessions');

export function sessionsResolvers(ctx: AppContext): Partial<Resolvers> {
  const sessions: QueryResolvers['sessions'] = (_parent, args) => {
    const start = performance.now();
    const readCtx = createReadContext();

    const filter = args.filter
      ? { activeOnly: args.filter.activeOnly ?? undefined, sortBy: args.filter.sortBy ?? undefined }
      : undefined;

    const result = ctx.ports.sessions.getSessions(filter, readCtx);

    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: sessions');
    }
    return result;
  };

  return { Query: { sessions } };
}
