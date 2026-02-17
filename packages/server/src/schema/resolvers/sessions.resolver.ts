import type { AppContext } from '../../context.js';
import type { Resolvers, QueryResolvers } from '../generated/resolver-types.js';

export function sessionsResolvers(ctx: AppContext): Partial<Resolvers> {
  const { sessionReader, spawnTracker } = ctx;

  const sessions: QueryResolvers['sessions'] = (_parent, args) => {
    sessionReader.attachSubAgents(spawnTracker.getParentChildMap());
    const filter = args.filter
      ? { activeOnly: args.filter.activeOnly ?? undefined, sortBy: args.filter.sortBy ?? undefined }
      : undefined;
    return sessionReader.getSessions(filter);
  };

  return { Query: { sessions } };
}
