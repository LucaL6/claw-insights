/* eslint-disable @typescript-eslint/no-deprecated -- Phase 2: legacy ctx.* refs not yet migrated to ports */
import type { AppContext } from '../../context.js';
import { getEventCounts, getEventDensity, queryEvents } from '../../db/event-queries.js';
import { createChildLogger } from '../../logger.js';
import type { QueryResolvers, Resolvers } from '../generated/resolver-types.js';
import { safe } from './utils.js';

const log = createChildLogger('resolver:events');

export function eventsResolvers(ctx: AppContext): Partial<Resolvers> {
  const { db } = ctx;

  const events: QueryResolvers['events'] = async (_parent, args) => {
    const start = performance.now();
    const result = await safe(() =>
      Promise.resolve(
        queryEvents(db, {
          from: args.from ?? undefined,
          to: args.to ?? undefined,
          types: args.types ?? undefined,
          limit: args.limit ?? undefined,
        }),
      ),
    );
    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: events');
    }
    return result;
  };

  const eventDensity: QueryResolvers['eventDensity'] = async () => {
    const start = performance.now();
    const result = await safe(() => Promise.resolve(getEventDensity(db)));
    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: eventDensity');
    }
    return result;
  };

  const eventCounts: QueryResolvers['eventCounts'] = async (_parent, args) => {
    const start = performance.now();
    const result = await safe(() =>
      Promise.resolve(
        getEventCounts(db, {
          from: args.from ?? undefined,
          to: args.to ?? undefined,
        }),
      ),
    );
    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: eventCounts');
    }
    return result;
  };

  return { Query: { events, eventDensity, eventCounts } };
}
