import type { AppContext } from '../../context.js';
import { createChildLogger } from '../../logger.js';
import { getAppVersion } from '../../version.js';
import type { ChannelProvider, QueryResolvers, Resolvers } from '../generated/resolver-types.js';
import { safe } from './utils.js';

const log = createChildLogger('resolver:gateway');

export function gatewayResolvers(ctx: AppContext): Partial<Resolvers> {
  const gateway: QueryResolvers['gateway'] = async () => {
    const start = performance.now();
    const result = await safe(async () => {
      const status = await ctx.gatewayClient.getGatewayStatus();
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
    const result = await safe(async () => {
      const status = await ctx.gatewayClient.getGatewayStatus();
      return status.channels as Array<{
        provider: ChannelProvider;
        name: string;
        connected: boolean;
        latencyMs: number | null;
      }>;
    });
    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: channels');
    }
    return result;
  };

  const resources: QueryResolvers['resources'] = async () => {
    const start = performance.now();
    const result = await safe(async () => ctx.systemInfoService.getSystemMetrics());
    const ms = performance.now() - start;
    if (ms > 100) {
      log.debug({ ms: Math.round(ms) }, 'slow resolve: resources');
    }
    return result;
  };

  return { Query: { gateway, channels, resources } };
}
