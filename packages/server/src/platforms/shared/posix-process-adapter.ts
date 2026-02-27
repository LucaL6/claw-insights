// src/platforms/shared/posix-process-adapter.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import type { ProcessAdapter } from '../../ports/types.js';
import { formatUptime, parseDuOutput, parsePsOutput } from './parsers.js';

const execFileAsync = promisify(execFile);

/**
 * Base class for POSIX-compatible systems (macOS + Linux).
 * Implements shared ps/du logic. Subclasses must implement getPid() and findPidByPort().
 */
export abstract class PosixProcessAdapter implements ProcessAdapter {
  abstract getPid(): Promise<number | null>;
  abstract findPidByPort(port: number): Promise<number | null>;

  async getProcessMetrics(pid: number): Promise<{ cpu: number; memoryMB: number } | null> {
    try {
      const { stdout } = await execFileAsync('ps', ['-o', 'rss=,pcpu=', '-p', String(pid)], { encoding: 'utf-8' });
      return parsePsOutput(stdout);
    } catch {
      return null;
    }
  }

  async getUptime(pid: number): Promise<string> {
    try {
      const { stdout } = await execFileAsync('ps', ['-o', 'etime=', '-p', String(pid)], {
        timeout: 2000,
        encoding: 'utf-8',
      });
      return formatUptime(stdout);
    } catch {
      return 'unknown';
    }
  }

  async getDiskMB(dir: string): Promise<number> {
    try {
      const { stdout } = await execFileAsync('du', ['-sm', `${dir}/`], { encoding: 'utf-8' });
      return parseDuOutput(stdout);
    } catch {
      return 0;
    }
  }
}
