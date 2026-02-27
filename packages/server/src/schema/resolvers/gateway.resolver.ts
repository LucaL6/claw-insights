import type { AppContext } from '../../context.js';
import { getAppVersion } from '../../version.js';
import type { ChannelProvider, QueryResolvers, Resolvers } from '../generated/resolver-types.js';
import { safe } from './utils.js';

export function gatewayResolvers(ctx: AppContext): Partial<Resolvers> {
  const gateway: QueryResolvers['gateway'] = () =>
    safe(async () => {
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

  const channels: QueryResolvers['channels'] = () =>
    safe(async () => {
      const status = await ctx.gatewayClient.getGatewayStatus();
      return status.channels as Array<{
        provider: ChannelProvider;
        name: string;
        connected: boolean;
        latencyMs: number | null;
      }>;
    });

  const resources: QueryResolvers['resources'] = () => safe(async () => ctx.systemInfoService.getSystemMetrics());

  return { Query: { gateway, channels, resources } };
}
