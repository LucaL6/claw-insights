import { execSync } from 'child_process';

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
  getPid(): number | null {
    try {
      const out = execSync('launchctl list 2>/dev/null | grep ai.openclaw.gateway', { encoding: 'utf-8' });
      const match = out.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : null;
    } catch {
      return null;
    }
  }

  /** Get disk usage of ~/.openclaw/ in MB */
  private getDiskMB(): number {
    try {
      const out = execSync(`du -sm ${process.env.HOME}/.openclaw/ 2>/dev/null`, { encoding: 'utf-8' });
      const match = out.match(/^(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    } catch {
      return 0;
    }
  }

  /** Get CPU% and RSS for a given PID */
  private getProcessMetrics(pid: number): { cpu: number; memoryMB: number } | null {
    try {
      const out = execSync(`ps -o rss=,pcpu= -p ${pid}`, { encoding: 'utf-8' }).trim();
      const parts = out.split(/\s+/);
      if (parts.length < 2) return null;
      const rssKB = parseInt(parts[0], 10);
      const cpu = parseFloat(parts[1]);
      return { cpu, memoryMB: Math.round(rssKB / 1024) };
    } catch {
      return null;
    }
  }

  getMetrics(): SystemMetricsData {
    const now = Date.now();
    if (this.cache && now - this.cacheTime < this.ttlMs) {
      return this.cache;
    }

    const pid = this.getPid();
    const proc = pid ? this.getProcessMetrics(pid) : null;

    this.cache = {
      cpu: proc?.cpu ?? 0,
      memoryMB: proc?.memoryMB ?? 0,
      diskMB: this.getDiskMB(),
      sampledAt: new Date().toISOString(),
    };
    this.cacheTime = now;
    return this.cache;
  }
}
