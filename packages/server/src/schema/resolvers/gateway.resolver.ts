import type { AppContext } from '../../context.js';
import { getGatewayStatus } from '../../sources/gateway-cli.js';
import { getSystemMetrics } from '../../sources/system-info.js';
import { getAppVersion } from '../../version.js';
import type { ChannelProvider,QueryResolvers, Resolvers } from '../generated/resolver-types.js';
import { safe } from './utils.js';

export function gatewayResolvers(_ctx: AppContext): Partial<Resolvers> {
  const gateway: QueryResolvers['gateway'] = () =>
    safe(async () => {
      const status = await getGatewayStatus();
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
      const status = await getGatewayStatus();
      return status.channels as Array<{
        provider: ChannelProvider;
        name: string;
        connected: boolean;
        latencyMs: number | null;
      }>;
    });

  const resources: QueryResolvers['resources'] = () => safe(async () => getSystemMetrics());

  return { Query: { gateway, channels, resources } };
}
