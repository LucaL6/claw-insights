/* eslint-disable @typescript-eslint/no-deprecated -- Phase 2: spawnTracker + sessionReader.attachSubAgents not yet migrated */
import type { AppContext } from '../../context.js';
import { createReadContext } from '../../context/read-context.js';
import { createChildLogger } from '../../logger.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';

const log = createChildLogger('resolver:sessions');

export function sessionsResolvers(ctx: AppContext): Partial<Resolvers> {
  const { spawnTracker } = ctx;

  const sessions: QueryResolvers['sessions'] = (_parent, args) => {
    const start = performance.now();
    const readCtx = createReadContext();

    // Preserve sub-agent attachment behavior
    // TODO: This will eventually be handled by the port itself
    if (ctx.sessionReader?.attachSubAgents) {
      ctx.sessionReader.attachSubAgents(spawnTracker.getParentChildMap());
    }

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
