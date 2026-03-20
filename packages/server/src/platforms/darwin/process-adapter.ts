// src/platforms/darwin/process-adapter.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { createChildLogger } from '../../logger.js';
import { parseLaunchctlOutput } from '../shared/parsers.js';
import { PosixProcessAdapter } from '../shared/posix-process-adapter.js';

const log = createChildLogger('platform:darwin');

const execFileAsync = promisify(execFile);

export class DarwinProcessAdapter extends PosixProcessAdapter {
  async getPid(): Promise<number | null> {
    // First try launchctl
    try {
      const { stdout } = await execFileAsync('launchctl', ['list'], { encoding: 'utf-8' });
      const pid = parseLaunchctlOutput(stdout);
      if (pid) {
        log.debug({ pid }, 'getPid via launchctl');
        return pid;
      }
    } catch (err) {
      log.debug({ err }, 'getPid launchctl failed, will try ps fallback');
    }

    // Fallback: use ps grep to find openclaw-gateway process
    try {
      const { stdout } = await execFileAsync('sh', ['-c', 'ps -ef | grep "openclaw-gateway" | grep -v grep | awk \'{print $2}\''], { encoding: 'utf-8' });
      const pidStr = stdout.trim();
      if (pidStr) {
        const pid = parseInt(pidStr, 10);
        if (!isNaN(pid)) {
          log.debug({ pid }, 'getPid via ps grep fallback');
          return pid;
        }
      }
    } catch (err) {
      log.warn({ err }, 'getPid ps grep fallback also failed');
    }

    return null;
  }

  findPidByPort(_port: number): Promise<number | null> {
    // macOS: no /proc filesystem
    return Promise.resolve(null);
  }
}
