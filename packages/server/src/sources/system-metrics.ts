import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { config } from '../config.js';

const execFileAsync = promisify(execFile);

interface SystemMetricsData {
  cpu: number;
  memoryMB: number;
  diskMB: number;
  sampledAt: string;
}

export class SystemMetrics {
  private cache: SystemMetricsData | null = null;
  private cacheTime = 0;
  private readonly ttlMs = 10_000;

  /** Get Gateway PID from launchctl */
  async getPid(): Promise<number | null> {
    try {
      const { stdout } = await execFileAsync('launchctl', ['list'], { encoding: 'utf-8' });
      const line = stdout.split('\n').find((l) => l.includes('ai.openclaw.gateway'));
      if (!line) return null;
      const match = line.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    } catch {
      return null;
    }
  }

  /** Get disk usage of ~/.openclaw/ in MB */
  private async getDiskMB(): Promise<number> {
    try {
      const { stdout } = await execFileAsync('du', ['-sm', `${config.openclawDir}/`], { encoding: 'utf-8' });
      const match = stdout.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    } catch {
      return 0;
    }
  }

  /** Get CPU% and RSS for a given PID */
  private async getProcessMetrics(pid: number): Promise<{ cpu: number; memoryMB: number } | null> {
    try {
      const { stdout } = await execFileAsync('ps', ['-o', 'rss=,pcpu=', '-p', String(pid)], { encoding: 'utf-8' });
      const trimmed = stdout.trim();
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) return null;
      const rssKB = parseInt(parts[0], 10);
      const cpu = parseFloat(parts[1]);
      return { cpu, memoryMB: Math.round(rssKB / 1024) };
    } catch {
      return null;
    }
  }

  async getMetrics(): Promise<SystemMetricsData> {
    const now = Date.now();
    if (this.cache && now - this.cacheTime < this.ttlMs) {
      return this.cache;
    }

    const pid = await this.getPid();
    const [proc, diskMB] = await Promise.all([
      pid ? this.getProcessMetrics(pid) : Promise.resolve(null),
      this.getDiskMB(),
    ]);

    this.cache = {
      cpu: proc?.cpu ?? 0,
      memoryMB: proc?.memoryMB ?? 0,
      diskMB,
      sampledAt: new Date().toISOString(),
    };
    this.cacheTime = now;
    return this.cache;
  }
}
