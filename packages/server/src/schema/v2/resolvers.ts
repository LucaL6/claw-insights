import {
  aggregateHealthStatus,
  type HealthStatus as AdapterHealthStatus,
  mapChannels,
  mapGateway,
  mapHealthStatus,
  mapResources,
} from '../../adapters/system-adapter.js';
import type { AppContext } from '../../context.js';
import { createReadContext, type ReadContext } from '../../context/read-context.js';
import { getEventCounts, getEventDensity, queryEvents } from '../../db/event-queries.js';
import type { Resolvers } from '../generated/resolver-types.js';
import { safe } from '../resolvers/utils.js';
import { createAgentAdapter } from './adapters/agent-adapter.js';
import { mergeMetricsArgs, mergeTimeRange } from './merge-filter.js';
import { extractQueryContext, type QueryContextData } from './query-context.js';
import { createSourceRegistry, type SourceAdapter } from './registry.js';
import type { FilterInput, SelectorInput } from './selector.js';

type GatewaySnapshot = Awaited<ReturnType<AppContext['ports']['gateway']['getGatewayStatus']>>;

interface GatewaySnapshotAware {
  _getGatewaySnapshot: () => Promise<GatewaySnapshot>;
}

interface ContextRoot extends GatewaySnapshotAware {
  _agent: SourceAdapter;
  _queryContext?: QueryContextData;
  _defaults?: QueryContextData['defaults'];
}

interface SystemRoot extends GatewaySnapshotAware {
  _kind: 'OpenClawSystem';
  _queryContext?: QueryContextData;
}

interface RequestMemo {
  readCtx: ReadContext;
  gatewaySnapshot?: Promise<GatewaySnapshot>;
}

const requestMemoByContext = new WeakMap<object, RequestMemo>();

const toCheckStatus = (status: AdapterHealthStatus): 'PASS' | 'WARN' | 'FAIL' => {
  if (status === 'HEALTHY') {
    return 'PASS';
  }
  if (status === 'DEGRADED') {
    return 'WARN';
  }
  return 'FAIL';
};

const toContextRoot = (
  adapter: SourceAdapter,
  parsed: QueryContextData | undefined,
  getGatewaySnapshot: () => Promise<GatewaySnapshot>,
): ContextRoot => {
  return {
    _agent: adapter,
    _getGatewaySnapshot: getGatewaySnapshot,
    ...(parsed ? { _queryContext: parsed } : {}),
    ...(parsed?.defaults ? { _defaults: parsed.defaults } : {}),
  };
};

const toSystemRoot = (
  parsed: QueryContextData | undefined,
  getGatewaySnapshot: () => Promise<GatewaySnapshot>,
): SystemRoot => ({
  _kind: 'OpenClawSystem',
  _getGatewaySnapshot: getGatewaySnapshot,
  ...(parsed ? { _queryContext: parsed } : {}),
});

const getRequestMemo = (gqlCtx: unknown): RequestMemo => {
  if (gqlCtx && typeof gqlCtx === 'object') {
    const key = gqlCtx;
    const existing = requestMemoByContext.get(key);
    if (existing) {
      return existing;
    }

    const created: RequestMemo = { readCtx: createReadContext() };
    requestMemoByContext.set(key, created);
    return created;
  }

  return { readCtx: createReadContext() };
};

const parseContextArg = (rawContext?: Record<string, unknown> | null): QueryContextData | undefined => {
  const parsed = extractQueryContext(rawContext);
  return Object.keys(parsed).length > 0 ? parsed : undefined;
};

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

  const defaultAgent = () => registry.getDefaultSource('AGENT') ?? agent;

  const getGatewaySnapshot = (parent: unknown, gqlCtx: unknown): Promise<GatewaySnapshot> => {
    if (
      parent &&
      typeof parent === 'object' &&
      '_getGatewaySnapshot' in (parent as Record<string, unknown>) &&
      typeof (parent as GatewaySnapshotAware)._getGatewaySnapshot === 'function'
    ) {
      return (parent as GatewaySnapshotAware)._getGatewaySnapshot();
    }

    const memo = getRequestMemo(gqlCtx);
    if (!memo.gatewaySnapshot) {
      memo.gatewaySnapshot = ctx.ports.gateway.getGatewayStatus(memo.readCtx);
    }
    return memo.gatewaySnapshot;
  };

  const query = {
    system: (_: unknown, args: { context?: Record<string, unknown> | null }, gqlCtx: unknown) => {
      const parsed = parseContextArg(args?.context ?? undefined);
      const memo = getRequestMemo(gqlCtx);
      return toSystemRoot(parsed, () => {
        if (!memo.gatewaySnapshot) {
          memo.gatewaySnapshot = ctx.ports.gateway.getGatewayStatus(memo.readCtx);
        }
        return memo.gatewaySnapshot;
      });
    },

    sources: (_: unknown, args: { filter?: FilterInput | null; context?: Record<string, unknown> | null }) => {
      // Parse for contract validation/normalization even when listing is unaffected.
      parseContextArg(args?.context ?? undefined);
      return registry.list(args?.filter ?? null);
    },

    source: (
      _: unknown,
      args: { selector: SelectorInput; context?: Record<string, unknown> | null },
      gqlCtx: unknown,
    ) => {
      const parsed = parseContextArg(args?.context ?? undefined);
      const found = registry.resolve(args.selector);
      if (!found) {
        return null;
      }

      const memo = getRequestMemo(gqlCtx);
      return toContextRoot(found, parsed, () => {
        if (!memo.gatewaySnapshot) {
          memo.gatewaySnapshot = ctx.ports.gateway.getGatewayStatus(memo.readCtx);
        }
        return memo.gatewaySnapshot;
      });
    },

    // Legacy compat entrypoint.
    context: (_: unknown, _args: unknown, gqlCtx: unknown) => {
      const memo = getRequestMemo(gqlCtx);
      return toContextRoot(defaultAgent(), undefined, () => {
        if (!memo.gatewaySnapshot) {
          memo.gatewaySnapshot = ctx.ports.gateway.getGatewayStatus(memo.readCtx);
        }
        return memo.gatewaySnapshot;
      });
    },
  };

  const legacyContextNamespace = {
    source: (parent: unknown) => parent as ContextRoot,
    system: (parent: unknown) => {
      const p = parent as ContextRoot;
      return toSystemRoot(p._queryContext, p._getGatewaySnapshot);
    },
  };

  const agentNamespace = {
    info: (parent: unknown) => {
      const p = parent as ContextRoot;
      return p._agent.info;
    },

    gateway: async (parent: unknown, _args: unknown, gqlCtx: unknown) => {
      return safe(async () => mapGateway(await getGatewaySnapshot(parent, gqlCtx)));
    },

    session: async (_parent: unknown, args: { key: string }) => {
      const readCtx = createReadContext();
      return safe(() => ctx.ports.sessions.getSessionById(args.key, readCtx));
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

  const openClawSystem = {
    health: async (parent: unknown, _args: unknown, gqlCtx: unknown) => {
      let gateway: GatewaySnapshot;
      try {
        gateway = await getGatewaySnapshot(parent, gqlCtx);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return {
          status: 'UNHEALTHY',
          checks: [
            {
              name: 'gateway',
              status: 'FAIL',
              message: `Gateway status unavailable: ${reason}`,
            },
            {
              name: 'channels',
              status: 'FAIL',
              message: 'Channels check skipped because gateway status is unavailable',
            },
            {
              name: 'security',
              status: 'FAIL',
              message: 'Security check skipped because gateway status is unavailable',
            },
          ],
        };
      }

      const gatewayHealth = mapHealthStatus(gateway.running ? 'connected' : 'disconnected', 'UNHEALTHY');

      const totalChannels = gateway.channels.length;
      const connectedChannels = gateway.channels.filter((c) => c.connectionStatus === 'connected').length;
      const channelsHealth =
        totalChannels === 0
          ? 'DEGRADED'
          : connectedChannels === totalChannels
            ? 'HEALTHY'
            : connectedChannels > 0
              ? 'DEGRADED'
              : 'UNHEALTHY';

      const securityHealth =
        gateway.securitySummary.critical > 0 ? 'UNHEALTHY' : gateway.securitySummary.warn > 0 ? 'DEGRADED' : 'HEALTHY';

      const overall = aggregateHealthStatus([gatewayHealth, channelsHealth, securityHealth]);

      return {
        status: overall,
        checks: [
          {
            name: 'gateway',
            status: toCheckStatus(gatewayHealth),
            message: gateway.running ? 'Gateway reachable' : 'Gateway unreachable',
          },
          {
            name: 'channels',
            status: toCheckStatus(channelsHealth),
            message:
              totalChannels === 0
                ? 'No channels configured'
                : `${connectedChannels}/${totalChannels} channels connected`,
          },
          {
            name: 'security',
            status: toCheckStatus(securityHealth),
            message: `critical=${gateway.securitySummary.critical}, warn=${gateway.securitySummary.warn}`,
          },
        ],
      };
    },

    gateway: async (parent: unknown, _args: unknown, gqlCtx: unknown) => {
      return mapGateway(await getGatewaySnapshot(parent, gqlCtx));
    },

    channels: async (parent: unknown, _args: unknown, gqlCtx: unknown) => {
      return mapChannels(await getGatewaySnapshot(parent, gqlCtx));
    },

    resources: async () => {
      const readCtx = createReadContext();
      return mapResources(await ctx.ports.system.getSystemMetrics(readCtx));
    },
  };

  return {
    Query: query,
    LegacyContextNamespace: legacyContextNamespace,
    AgentNamespace: agentNamespace,
    OpenClawSystem: openClawSystem,

    SourceNamespace: {
      __resolveType: (value: unknown) => {
        if (value && typeof value === 'object' && '_agent' in (value as Record<string, unknown>)) {
          return 'AgentNamespace';
        }
        return null;
      },
    },

    SystemNamespace: {
      __resolveType: () => 'OpenClawSystem',
    },

    HasSourceInfo: {
      __resolveType: () => 'AgentNamespace',
    },

    HasSystemInfo: {
      __resolveType: () => 'OpenClawSystem',
    },
  } as unknown as Partial<Resolvers>;
};
