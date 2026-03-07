// src/adapters/system-adapter.ts
import { mapInfraError } from '../ports/error-mapping.js';
import type { GatewayStatus } from '../ports/gateway-port.js';
import type { ReadContext } from '../ports/shared.js';
import type { SystemMetrics, SystemPort } from '../ports/system-port.js';
import type { Platform } from '../ports/types.js';
import type { SystemInfoService } from '../sources/system-info.js';
import { getAppVersion } from '../version.js';

const SOURCE = 'system-adapter';

// ── Health-status mapping ──────────────────────────────────────────────
// Normalises heterogeneous upstream health indicators into a single enum.
// Two common vocabularies exist across our sources:
//   • gateway / db:  "ok" | "connected" | "disconnected" | "error" | "pending"
//   • check-style:   "PASS" | "WARN" | "FAIL"
// Both collapse into HealthStatus.

export type HealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';

const KEYWORD_MAP: Record<string, HealthStatus> = {
  // gateway / db raw values
  ok: 'HEALTHY',
  connected: 'HEALTHY',
  healthy: 'HEALTHY',
  pass: 'HEALTHY',

  degraded: 'DEGRADED',
  warn: 'DEGRADED',
  warning: 'DEGRADED',
  pending: 'DEGRADED',
  starting: 'DEGRADED',

  unhealthy: 'UNHEALTHY',
  fail: 'UNHEALTHY',
  error: 'UNHEALTHY',
  disconnected: 'UNHEALTHY',
};

/**
 * Map an arbitrary upstream status string to a normalised HealthStatus.
 * Returns `fallback` (default DEGRADED) when the input is null / undefined /
 * not recognised — this keeps the UI informative rather than crashing.
 */
export function mapHealthStatus(raw: string | null | undefined, fallback: HealthStatus = 'DEGRADED'): HealthStatus {
  if (raw == null) {return fallback;}
  return KEYWORD_MAP[raw.toLowerCase().trim()] ?? fallback;
}

/**
 * Derive an aggregate HealthStatus from a set of component statuses.
 * Any UNHEALTHY → UNHEALTHY; any DEGRADED → DEGRADED; else HEALTHY.
 */
export function aggregateHealthStatus(statuses: HealthStatus[]): HealthStatus {
  if (statuses.length === 0) {return 'DEGRADED';}
  if (statuses.includes('UNHEALTHY')) {return 'UNHEALTHY';}
  if (statuses.includes('DEGRADED')) {return 'DEGRADED';}
  return 'HEALTHY';
}

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
