// src/adapters/system-adapter.ts
import { mapInfraError } from '../ports/error-mapping.js';
import type { GatewayStatus } from '../ports/gateway-port.js';
import type { ReadContext } from '../ports/shared.js';
import type { SystemMetrics, SystemPort } from '../ports/system-port.js';
import type { Platform } from '../ports/types.js';
import type { SystemInfoService } from '../sources/system-info.js';
import { getAppVersion } from '../version.js';

const SOURCE = 'system-adapter';

export function mapSystemMetrics(data: Pick<SystemMetrics, 'cpu' | 'memoryMB' | 'diskMB'>): SystemMetrics {
  return {
    cpu: data.cpu,
    memoryMB: data.memoryMB,
    diskMB: data.diskMB,
    uptime: process.uptime().toFixed(0) + 's',
    platform: process.platform,
    nodeVersion: process.version,
  };
}

export function mapGateway(status: GatewayStatus): {
  running: boolean;
  pid: number | null;
  version: string;
  appVersion: string;
  updateAvailable: string | null;
  uptime: string;
  startedAt: string | null;
  connectLatencyMs: number | null;
  latestVersion: string | null;
  securityCritical: number;
  securityWarn: number;
} {
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
}

export function mapChannels(status: Pick<GatewayStatus, 'channels'>): Array<{
  provider: string;
  name: string;
  connected: boolean;
  latencyMs: number | null;
}> {
  return status.channels.map((ch) => ({
    provider: ch.type,
    name: ch.name ?? 'unknown',
    connected: ch.connectionStatus === 'connected',
    latencyMs: null,
  }));
}

export function mapResources(metrics: Pick<SystemMetrics, 'cpu' | 'memoryMB' | 'diskMB'>): {
  cpu: number;
  memoryMB: number;
  diskMB: number;
  sampledAt: string;
} {
  return {
    cpu: metrics.cpu,
    memoryMB: metrics.memoryMB,
    diskMB: metrics.diskMB,
    sampledAt: new Date().toISOString(),
  };
}

export function createSystemAdapter(
  service: SystemInfoService,
  platform: Platform,
): SystemPort & { destroy: () => void } {
  async function getSystemMetrics(_context?: ReadContext): Promise<SystemMetrics> {
    try {
      const data = await service.getSystemMetrics();
      return mapSystemMetrics(data);
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  async function getProcessMetrics(
    pid: number,
    _context?: ReadContext,
  ): Promise<{ cpu: number; memoryMB: number } | null> {
    try {
      const metrics = await platform.process.getProcessMetrics(pid);
      return metrics ?? null;
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function destroy(): void {
    // No-op: SystemAdapter has no stateful resources to clean up
  }

  return { getSystemMetrics, getProcessMetrics, destroy };
}
