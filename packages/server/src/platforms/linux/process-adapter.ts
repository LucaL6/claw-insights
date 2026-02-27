// src/platforms/linux/process-adapter.ts
import { execFile } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { readdir, readFile, readlink } from 'node:fs/promises';
import { promisify } from 'node:util';

import { PosixProcessAdapter } from '../shared/posix-process-adapter.js';

const execFileAsync = promisify(execFile);

/**
 * Linux process adapter. Extends POSIX base with /proc filesystem fallbacks.
 * Uses pgrep + /proc/cmdline for getPid (no launchctl on Linux).
 */
export class LinuxProcessAdapter extends PosixProcessAdapter {
  private clkTck: number | null = null;

  private async getClkTck(): Promise<number> {
    if (this.clkTck !== null) {return this.clkTck;}
    try {
      const { stdout } = await execFileAsync('getconf', ['CLK_TCK'], {
        timeout: 2000,
        encoding: 'utf-8',
      });
      const val = parseInt(stdout.trim(), 10);
      this.clkTck = isNaN(val) ? 100 : val;
    } catch {
      this.clkTck = 100; // safe default
    }
    return this.clkTck;
  }

  async getPid(): Promise<number | null> {
    // Method 1: pgrep for the openclaw gateway process
    try {
      const { stdout } = await execFileAsync('pgrep', ['-f', 'openclaw.*gateway'], {
        encoding: 'utf-8',
        timeout: 3000,
      });
      const pid = parseInt(stdout.trim().split('\n')[0], 10);
      if (!isNaN(pid)) {
        return pid;
      }
    } catch {
      /* pgrep not found or no match */
    }

    // Method 2: Scan /proc/*/cmdline for openclaw gateway
    try {
      const procs = readdirSync('/proc').filter((d) => /^\d+$/.test(d));
      for (const p of procs) {
        try {
          const cmdline = readFileSync(`/proc/${p}/cmdline`, 'utf-8');
          if (cmdline.includes('openclaw') && cmdline.includes('gateway')) {
            return parseInt(p, 10);
          }
        } catch {
          /* permission denied or process gone */
        }
      }
    } catch {
      /* /proc not available */
    }

    return null;
  }

  async findPidByPort(port: number): Promise<number | null> {
    try {
      const hexPort = port.toString(16).toUpperCase().padStart(4, '0');
      const inodes = new Set<string>();

      for (const tcpFile of ['/proc/net/tcp', '/proc/net/tcp6']) {
        try {
          const tcp = await readFile(tcpFile, 'utf-8');
          for (const line of tcp.split('\n').slice(1)) {
            const cols = line.trim().split(/\s+/);
            if (!cols[1]) {
              continue;
            }
            const localPort = cols[1].split(':').pop();
            if (localPort === hexPort && cols[3] === '0A') {
              inodes.add(cols[9]);
            }
          }
        } catch {
          /* file not present */
        }
      }
      if (inodes.size === 0) {
        return null;
      }

      const procs = (await readdir('/proc')).filter((d) => /^\d+$/.test(d));
      for (const p of procs) {
        try {
          const fds = await readdir(`/proc/${p}/fd`);
          for (const fd of fds) {
            try {
              const link = await readlink(`/proc/${p}/fd/${fd}`);
              const m = link.match(/socket:\[(\d+)\]/);
              if (m && inodes.has(m[1])) {
                return parseInt(p, 10);
              }
            } catch {
              /* permission denied */
            }
          }
        } catch {
          /* process gone */
        }
      }
    } catch {
      /* /proc not available */
    }
    return null;
  }

  override async getUptime(pid: number): Promise<string> {
    // Method 1: POSIX ps (inherited)
    const psResult = await super.getUptime(pid);
    if (psResult !== 'unknown') {
      return psResult;
    }

    // Method 2: /proc fallback
    try {
      const stat = await readFile(`/proc/${pid}/stat`, 'utf-8');
      const afterComm = stat.slice(stat.lastIndexOf(') ') + 2);
      const fields = afterComm.split(' ');
      const startTicks = Number(fields[19]);
      const uptimeRaw = await readFile('/proc/uptime', 'utf-8');
      const bootSeconds = parseFloat(uptimeRaw.split(' ')[0]);
      const clkTck = await this.getClkTck();
      const processStartSec = startTicks / clkTck;
      const elapsedSec = Math.floor(bootSeconds - processStartSec);
      if (elapsedSec < 0) {
        return 'unknown';
      }
      const h = Math.floor(elapsedSec / 3600);
      const m = Math.floor((elapsedSec % 3600) / 60);
      const s = elapsedSec % 60;
      if (h > 0) {
        return `${h}h ${m}m`;
      }
      if (m > 0) {
        return `${m}m ${s}s`;
      }
      return `${s}s`;
    } catch {
      return 'unknown';
    }
  }
}
