import type { AppContext } from '../../context.js';
import { createReadContext } from '../../context/read-context.js';
import { createChildLogger } from '../../logger.js';
import { getAppVersion } from '../../version.js';
import type { ChannelProvider, QueryResolvers, Resolvers } from '../generated/resolver-types.js';
import { safe } from './utils.js';

const log = createChildLogger('resolver:gateway');

export function gatewayResolvers(ctx: AppContext): Partial<Resolvers> {
  const gateway: QueryResolvers['gateway'] = async () => {
    const start = performance.now();
    const readCtx = createReadContext();

    const result = await safe(async () => {
      const status = await ctx.ports.gateway.getGatewayStatus(readCtx);
      return {
        running: status.running,
        pid: status.pid,
        version: status.version,
        appVersion: getAppVersion(),
        updateAvailable: status.updateAvailable,
        uptime: status.uptime,
        startedAt: status.startedAt,
        connectLatencyMs: status.connectLatencyMs,
        latestVersion: status.latestVersion,
        securityCritical: status.securitySummary.critical,
        securityWarn: status.securitySummary.warn,
      };
    });

    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: gateway');
    }
    return result;
  };

  const channels: QueryResolvers['channels'] = async () => {
    const start = performance.now();
    const readCtx = createReadContext();

    const result = await safe(async () => {
      const status = await ctx.ports.gateway.getGatewayStatus(readCtx);
      // Map ChannelInfo to GraphQL Channel type
      return status.channels.map((ch) => ({
        provider: String(ch.provider).toLowerCase() as ChannelProvider,
        name: ch.name ?? 'unknown',
        connected: ch.connected,
        latencyMs: ch.latencyMs ?? null,
      }));
    });

    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: channels');
    }
    return result;
  };

  const resources: QueryResolvers['resources'] = async () => {
    const start = performance.now();
    const readCtx = createReadContext();

    const result = await safe(async () => {
      const metrics = await ctx.ports.system.getSystemMetrics(readCtx);
      // Map SystemMetrics to GraphQL SystemResources
      return {
        cpu: metrics.cpu,
        memoryMB: metrics.memoryMB,
        diskMB: metrics.diskMB,
        sampledAt: new Date().toISOString(),
      };
    });

    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: resources');
    }
    return result;
  };

  return { Query: { gateway, channels, resources } };
}
