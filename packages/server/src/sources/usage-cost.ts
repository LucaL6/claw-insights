import { execSync } from 'node:child_process';

const CLI_PATH = process.env.OPENCLAW_CLI ?? './.npm-global/bin/openclaw';

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

export function getUsageCost(): UsageCost {
  if (cache && Date.now() - cache.ts < CACHE_TTL) return cache.data;

  try {
    const output = execSync(`${CLI_PATH} gateway usage-cost`, {
      timeout: 15000,
      encoding: 'utf-8',
      env: { ...process.env, PATH: `${process.env.HOME}/.npm-global/bin:${process.env.HOME}/.bun/bin:${process.env.PATH}` },
    });
    const data = parseUsageCostOutput(output);
    cache = { data, ts: Date.now() };
    return data;
  } catch {
    return cache?.data ?? { totalCost: 0, totalTokensM: 0, todayCost: 0, todayTokensM: 0, fetchedAt: new Date().toISOString() };
  }
}
