import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config, CLI_ENV } from '../config.js';

const execFileAsync = promisify(execFile);

// ── System Metrics ──────────────────────────────────────────────

export interface SystemMetricsData {
  cpu: number;
  memoryMB: number;
  diskMB: number;
  sampledAt: string;
}

let metricsCache: { data: SystemMetricsData; ts: number } | null = null;
const METRICS_CACHE_TTL = 10_000;

// Pure parse functions (exported for testing)

export function parseLaunchctlOutput(stdout: string): number | null {
  const line = stdout.split('\n').find((l) => l.includes('ai.openclaw.gateway'));
  if (!line) return null;
  const match = line.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}

export function parsePsOutput(stdout: string): { cpu: number; memoryMB: number } | null {
  const trimmed = stdout.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) return null;
  const rssKB = parseInt(parts[0], 10);
  const cpu = parseFloat(parts[1]);
  if (isNaN(rssKB) || isNaN(cpu)) return null;
  return { cpu, memoryMB: Math.round(rssKB / 1024) };
}

export function parseDuOutput(stdout: string): number {
  const match = stdout.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

async function getPid(): Promise<number | null> {
  try {
    const { stdout } = await execFileAsync('launchctl', ['list'], { encoding: 'utf-8' });
    return parseLaunchctlOutput(stdout);
  } catch {
    return null;
  }
}

async function getProcessMetrics(pid: number): Promise<{ cpu: number; memoryMB: number } | null> {
  try {
    const { stdout } = await execFileAsync('ps', ['-o', 'rss=,pcpu=', '-p', String(pid)], { encoding: 'utf-8' });
    return parsePsOutput(stdout);
  } catch {
    return null;
  }
}

async function getDiskMB(): Promise<number> {
  try {
    const { stdout } = await execFileAsync('du', ['-sm', `${config.openclawDir}/`], { encoding: 'utf-8' });
    return parseDuOutput(stdout);
  } catch {
    return 0;
  }
}

export async function getSystemMetrics(): Promise<SystemMetricsData> {
  const now = Date.now();
  if (metricsCache && now - metricsCache.ts < METRICS_CACHE_TTL) {
    return metricsCache.data;
  }

  const pid = await getPid();
  const [proc, diskMB] = await Promise.all([pid ? getProcessMetrics(pid) : Promise.resolve(null), getDiskMB()]);

  const data: SystemMetricsData = {
    cpu: proc?.cpu ?? 0,
    memoryMB: proc?.memoryMB ?? 0,
    diskMB,
    sampledAt: new Date().toISOString(),
  };
  metricsCache = { data, ts: now };
  return data;
}

// ── Usage Cost ──────────────────────────────────────────────────

export interface UsageCost {
  totalCost: number;
  totalTokensM: number;
  todayCost: number;
  todayTokensM: number;
  fetchedAt: string;
}

let costCache: { data: UsageCost; ts: number } | null = null;
const COST_CACHE_TTL = 5 * 60 * 1000;

export function parseUsageCostOutput(output: string): UsageCost {
  const result: UsageCost = {
    totalCost: 0,
    totalTokensM: 0,
    todayCost: 0,
    todayTokensM: 0,
    fetchedAt: new Date().toISOString(),
  };

  const totalMatch = output.match(/Total:\s*\$([\d.]+)\s*·\s*([\d.]+)m\s*tokens/i);
  if (totalMatch) {
    result.totalCost = parseFloat(totalMatch[1]);
    result.totalTokensM = parseFloat(totalMatch[2]);
  }

  const todayMatch = output.match(/Latest day:.*?\$([\d.]+)\s*·\s*([\d.]+)m\s*tokens/i);
  if (todayMatch) {
    result.todayCost = parseFloat(todayMatch[1]);
    result.todayTokensM = parseFloat(todayMatch[2]);
  }

  return result;
}

export async function getUsageCost(): Promise<UsageCost> {
  if (costCache && Date.now() - costCache.ts < COST_CACHE_TTL) return costCache.data;

  try {
    const { stdout } = await execFileAsync(config.cliPath, ['gateway', 'usage-cost'], {
      timeout: 15000,
      encoding: 'utf-8',
      env: CLI_ENV,
    });
    const data = parseUsageCostOutput(stdout);
    costCache = { data, ts: Date.now() };
    return data;
  } catch (err) {
    console.warn('[usage-cost] CLI call failed:', (err as Error).message);
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
}

// ── Cache management ────────────────────────────────────────────

export function resetMetricsCache(): void {
  metricsCache = null;
}

export function resetCostCache(): void {
  costCache = null;
}
