import type { AppContext } from '../../context.js';
import type { Resolvers } from '../generated/resolver-types.js';
import { cronResolvers } from './cron.resolver.js';
import { diagnosticsResolvers } from './diagnostics.resolver.js';
import { eventsResolvers } from './events.resolver.js';
import { gatewayResolvers } from './gateway.resolver.js';
import { lifetimeResolvers } from './lifetime.resolver.js';
import { metricsResolvers } from './metrics.resolver.js';
import { sessionsResolvers } from './sessions.resolver.js';
import { subscriptionResolvers } from './subscriptions.resolver.js';
import { usageResolvers } from './usage.resolver.js';

type ResolverFactory = (ctx: AppContext) => Partial<Resolvers>;

const factories: ResolverFactory[] = [
  gatewayResolvers,
  sessionsResolvers,
  metricsResolvers,
  cronResolvers,
  eventsResolvers,
  usageResolvers,
  subscriptionResolvers,
  diagnosticsResolvers,
  lifetimeResolvers,
];

export function createResolvers(ctx: AppContext): Resolvers {
  const merged: Record<string, Record<string, unknown>> = {};
  for (const factory of factories) {
    const partial = factory(ctx);
    for (const [rootType, fields] of Object.entries(partial)) {
      merged[rootType] = { ...merged[rootType], ...(fields as Record<string, unknown>) };
    }
  }
  return merged as unknown as Resolvers;
}
