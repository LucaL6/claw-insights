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
    try {
      const { stdout } = await execFileAsync('launchctl', ['list'], { encoding: 'utf-8' });
      const pid = parseLaunchctlOutput(stdout);
      log.debug({ pid }, 'getPid via launchctl');
      return pid;
    } catch (err) {
      log.warn({ err }, 'getPid launchctl failed');
      return null;
    }
  }

  findPidByPort(_port: number): Promise<number | null> {
    // macOS: no /proc filesystem
    return Promise.resolve(null);
  }
}
