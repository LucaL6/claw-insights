import type { SystemSnapshot } from './types.js';

interface SessionReaderLike {
  getSessions(): Array<{ status: string }>;
  getTotalTokensK(): number;
}

interface AggregatorLike {
  getMetrics(): {
    totalErrors: number;
    totalWarnings: number;
    buckets: Array<{ restartEvent: boolean }>;
  };
}

interface SystemMetricsData {
  cpu: number;
  memoryMB: number;
  diskMB: number;
}

interface UsageCostData {
  todayCost: number;
}

export interface SnapshotDeps {
  sessionReader: SessionReaderLike;
  aggregator: AggregatorLike;
  getSystemMetrics: () => Promise<SystemMetricsData>;
  getUsageCost: () => Promise<UsageCostData>;
  getGatewayRunning: () => Promise<boolean | null>;
}

export async function buildSnapshot(deps: SnapshotDeps): Promise<SystemSnapshot> {
  const [sysMetrics, cost, gatewayRunning] = await Promise.all([
    deps.getSystemMetrics(),
    deps.getUsageCost(),
    deps.getGatewayRunning(),
  ]);

  const sessions = deps.sessionReader.getSessions();
  const activeSessions = sessions.filter((s) => s.status === 'ACTIVE').length;
  const metrics = deps.aggregator.getMetrics();

  return {
    cpu: sysMetrics.cpu,
    memoryMB: sysMetrics.memoryMB,
    diskMB: sysMetrics.diskMB,
    activeSessions,
    totalTokensK: deps.sessionReader.getTotalTokensK(),
    errorsLast24h: metrics.totalErrors,
    warningsLast24h: metrics.totalWarnings,
    gatewayRunning,
    recentRestarts: metrics.buckets.filter((b) => b.restartEvent).length,
    costTodayUsd: cost.todayCost,
  };
}
