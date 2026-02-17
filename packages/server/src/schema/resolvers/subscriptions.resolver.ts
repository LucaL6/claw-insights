import { Repeater } from 'graphql-yoga';
import { dataBus } from '../../events.js';
import type { DataChangeEvent } from '../../events.js';
import type { AppContext } from '../../context.js';
import type { Resolvers } from '../generated/resolver-types.js';

export function subscriptionResolvers(ctx: AppContext): Partial<Resolvers> {
  const { logTailer } = ctx;

  return {
    Subscription: {
      logs: {
        subscribe: (_parent: unknown, args: { filter?: { level?: string; module?: string } }) =>
          new Repeater(async (push, stop) => {
            const handler = (e: { level: string; module: string; time: string; message: string }) => {
              if (args.filter?.level) {
                const levels = ['DEBUG', 'INFO', 'WARN', 'ERROR'];
                if (levels.indexOf(e.level) < levels.indexOf(args.filter.level)) return;
              }
              if (args.filter?.module && e.module !== args.filter.module) return;
              push({ logs: { entries: [e], counts: { debug: 0, info: 0, warn: 0, error: 0 } } });
            };
            logTailer.on('log', handler);
            stop.then(() => logTailer.off('log', handler));
          }),
      },
      dataChanged: {
        subscribe: () =>
          new Repeater(async (push, stop) => {
            const handler = (event: DataChangeEvent) => {
              push({ dataChanged: event });
            };
            dataBus.on('change', handler);
            stop.then(() => dataBus.off('change', handler));
          }),
      },
    },
  } as Partial<Resolvers>;
}
