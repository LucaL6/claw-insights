import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config, CLI_ENV } from '../config.js';

const execFileAsync = promisify(execFile);

export interface UsageCost {
  totalCost: number;
  totalTokensM: number;
  todayCost: number;
  todayTokensM: number;
  fetchedAt: string;
}

export function parseUsageCostOutput(output: string): UsageCost {
  const result: UsageCost = { totalCost: 0, totalTokensM: 0, todayCost: 0, todayTokensM: 0, fetchedAt: new Date().toISOString() };

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

let cache: { data: UsageCost; ts: number } | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5min

export async function getUsageCost(): Promise<UsageCost> {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;

  try {
    const { stdout } = await execFileAsync(config.cliPath, ['gateway', 'usage-cost'], {
      timeout: 15000,
      encoding: 'utf-8',
      env: CLI_ENV,
    });
    const data = parseUsageCostOutput(stdout);
    cache = { data, ts: Date.now() };
    return data;
  } catch (err) {
    console.warn('[usage-cost] CLI call failed:', (err as Error).message);
    return cache?.data ?? { totalCost: 0, totalTokensM: 0, todayCost: 0, todayTokensM: 0, fetchedAt: new Date().toISOString() };
  }
}
