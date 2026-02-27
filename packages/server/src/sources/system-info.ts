import { config } from '../config.js';
import { createChildLogger } from '../logger.js';
import type { UsageCost } from '../platforms/shared/parsers.js';
import { parseUsageCostOutput } from '../platforms/shared/parsers.js';
import type { Platform } from '../ports/types.js';

// Re-export shared parsers for test/consumer convenience
export type { UsageCost } from '../platforms/shared/parsers.js';
export {
  parseDuOutput,
  parseLaunchctlOutput,
  parsePsOutput,
  parseUsageCostOutput,
} from '../platforms/shared/parsers.js';

const log = createChildLogger('system-info');

// ── Types ───────────────────────────────────────────────────────

export interface SystemMetricsData {
  cpu: number;
  memoryMB: number;
  diskMB: number;
  sampledAt: string;
}

export interface SystemInfoService {
  getSystemMetrics(): Promise<SystemMetricsData>;
  getUsageCost(): Promise<UsageCost>;
  resetMetricsCache(): void;
  resetCostCache(): void;
}

// ── Factory Function ────────────────────────────────────────────

const METRICS_CACHE_TTL = 10_000;
const COST_CACHE_TTL = 5 * 60 * 1000;

export function createSystemInfoService(platform: Platform): SystemInfoService {
  const proc = platform.process;
  const cli = platform.cli;

  let metricsCache: { data: SystemMetricsData; ts: number } | null = null;
  let costCache: { data: UsageCost; ts: number } | null = null;

  async function getSystemMetrics(): Promise<SystemMetricsData> {
    const now = Date.now();
    if (metricsCache && now - metricsCache.ts < METRICS_CACHE_TTL) {
      return metricsCache.data;
    }

    // Demo mode: return fixed values for reproducible screenshots
    const demoCpu = process.env.CLAW_INSIGHTS_DEMO_CPU;
    const demoMem = process.env.CLAW_INSIGHTS_DEMO_MEM;
    if (demoCpu != null && demoMem != null) {
      const data: SystemMetricsData = {
        cpu: parseFloat(demoCpu),
        memoryMB: parseInt(demoMem, 10),
        diskMB: 0,
        sampledAt: new Date().toISOString(),
      };
      metricsCache = { data, ts: now };
      return data;
    }

    const pid = await proc.getPid();
    const [metrics, diskMB] = await Promise.all([
      pid ? proc.getProcessMetrics(pid) : Promise.resolve(null),
      proc.getDiskMB(config.openclawDir),
    ]);

    const data: SystemMetricsData = {
      cpu: metrics?.cpu ?? 0,
      memoryMB: metrics?.memoryMB ?? 0,
      diskMB,
      sampledAt: new Date().toISOString(),
    };
    metricsCache = { data, ts: now };
    return data;
  }

  async function getUsageCost(): Promise<UsageCost> {
    if (costCache && Date.now() - costCache.ts < COST_CACHE_TTL) {
      return costCache.data;
    }

    const stdout = await cli.exec(['gateway', 'usage-cost']);
    if (stdout.trim()) {
      const data = parseUsageCostOutput(stdout);
      costCache = { data, ts: Date.now() };
      return data;
    }

    // CLI failure — return cached or zeros
    log.warn('usage-cost CLI call returned empty');
    return (
      costCache?.data ?? {
        totalCost: 0,
        totalTokensM: 0,
        todayCost: 0,
        todayTokensM: 0,
        fetchedAt: new Date().toISOString(),
      }
    );
  }

  return {
    getSystemMetrics,
    getUsageCost,
    resetMetricsCache: () => {
      metricsCache = null;
    },
    resetCostCache: () => {
      costCache = null;
    },
  };
}
