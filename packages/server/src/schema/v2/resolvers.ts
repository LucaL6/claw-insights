import { mapChannels, mapGateway, mapResources } from '../../adapters/system-adapter.js';
import type { AppContext } from '../../context.js';
import { createReadContext } from '../../context/read-context.js';
import { getEventCounts, getEventDensity, queryEvents } from '../../db/event-queries.js';
import type { Resolvers } from '../generated/resolver-types.js';
import { safe } from '../resolvers/utils.js';
import { createAgentAdapter } from './adapters/agent-adapter.js';
import { mergeMetricsArgs, mergeTimeRange } from './merge-filter.js';
import { createSourceRegistry, type SourceAdapter } from './registry.js';

interface ContextRoot {
  _agent: SourceAdapter;
  // Phase 3 scaffolding: populated from extractQueryContext() when context input is added.
  _defaults?: { timeRange?: { from?: number | null; to?: number | null; preset?: string | null } | null };
}

export const createV2Resolvers = (ctx: AppContext): Partial<Resolvers> => {
  const registry = createSourceRegistry();
  const agent = createAgentAdapter(
    'agent:main',
    'OpenClaw Agent (Main)',
    ctx.ports,
    { queryEvents, getEventDensity, getEventCounts },
    ctx.db,
    {
      runValidation: () => ctx.dataValidator.runValidation(),
    },
  );
  registry.register(agent);

  const query = {
    // Phase 3 scaffolding: selector/default context input wiring will resolve source + defaults here.
    context: () => ({ _agent: registry.getDefaultSource('AGENT') ?? agent }),
  };

  const queryContext = {
    source: (parent: unknown) => parent as Record<string, unknown>,
    system: (parent: unknown) => parent as Record<string, unknown>,
  };

  const source = {
    gateway: async () => {
      const readCtx = createReadContext();
      return safe(async () => mapGateway(await ctx.ports.gateway.getGatewayStatus(readCtx)));
    },

    sessions: (parent: unknown, args: Record<string, unknown>) => {
      const p = parent as ContextRoot;
      return safe(() => Promise.resolve(p._agent.resolvers.sessions(args as unknown as Record<string, unknown>)));
    },

    metrics: (parent: unknown, args: Record<string, unknown>) => {
      const p = parent as ContextRoot;
      const merged = mergeMetricsArgs(args, p._defaults);
      return safe(() => Promise.resolve(p._agent.resolvers.metrics(merged as unknown as Record<string, unknown>)));
    },

    cronJobs: (parent: unknown) => {
      const p = parent as ContextRoot;
      return safe(() => Promise.resolve(p._agent.resolvers.cronJobs({})));
    },

    usageCost: (parent: unknown) => {
      const p = parent as ContextRoot;
      return safe(() => Promise.resolve(p._agent.resolvers.usageCost({})));
    },

    recentLogs: (parent: unknown, args: Record<string, unknown>) => {
      const p = parent as ContextRoot;
      return safe(() => Promise.resolve(p._agent.resolvers.recentLogs(args as unknown as Record<string, unknown>)));
    },

    events: (parent: unknown, args: { from?: number | null; to?: number | null; [key: string]: unknown }) => {
      const p = parent as ContextRoot;
      const merged = mergeTimeRange(args, p._defaults);
      return safe(() =>
        Promise.resolve(
          p._agent.resolvers.events({
            ...args,
            ...merged,
          } as unknown as Record<string, unknown>),
        ),
      );
    },

    eventDensity: (parent: unknown) => {
      const p = parent as ContextRoot;
      return safe(() => Promise.resolve(p._agent.resolvers.eventDensity({})));
    },

    eventCounts: (parent: unknown, args: { from?: number | null; to?: number | null }) => {
      const p = parent as ContextRoot;
      const merged = mergeTimeRange(args, p._defaults);
      return safe(() => Promise.resolve(p._agent.resolvers.eventCounts(merged as unknown as Record<string, unknown>)));
    },

    lifetimeStats: (parent: unknown) => {
      const p = parent as ContextRoot;
      return safe(() => Promise.resolve(p._agent.resolvers.lifetimeStats({})));
    },

    sessionTranscript: (parent: unknown, args: Record<string, unknown>) => {
      const p = parent as ContextRoot;
      return Promise.resolve(p._agent.resolvers.sessionTranscript(args as unknown as Record<string, unknown>));
    },
  };

  return {
    Query: query,
    QueryContext: queryContext,
    SourceNamespace: source,
    SystemNamespace: {
      channels: async () => {
        const readCtx = createReadContext();
        return mapChannels(await ctx.ports.gateway.getGatewayStatus(readCtx));
      },
      resources: async () => {
        const readCtx = createReadContext();
        return mapResources(await ctx.ports.system.getSystemMetrics(readCtx));
      },
    },
  } as unknown as Partial<Resolvers>;
};
