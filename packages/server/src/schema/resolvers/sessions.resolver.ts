import type { AppContext } from '../../context.js';
import { createChildLogger } from '../../logger.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';

const log = createChildLogger('resolver:sessions');

export function sessionsResolvers(ctx: AppContext): Partial<Resolvers> {
  const { sessionReader, spawnTracker } = ctx;

  const sessions: QueryResolvers['sessions'] = (_parent, args) => {
    const start = performance.now();
    sessionReader.attachSubAgents(spawnTracker.getParentChildMap());
    const filter = args.filter
      ? { activeOnly: args.filter.activeOnly ?? undefined, sortBy: args.filter.sortBy ?? undefined }
      : undefined;
    const result = sessionReader.getSessions(filter);
    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: sessions');
    }
    return result;
  };

  return { Query: { sessions } };
}
