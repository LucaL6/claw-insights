// src/platforms/darwin/process-adapter.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { parseLaunchctlOutput } from '../shared/parsers.js';
import { PosixProcessAdapter } from '../shared/posix-process-adapter.js';

const execFileAsync = promisify(execFile);

export class DarwinProcessAdapter extends PosixProcessAdapter {
  async getPid(): Promise<number | null> {
    try {
      const { stdout } = await execFileAsync('launchctl', ['list'], { encoding: 'utf-8' });
      return parseLaunchctlOutput(stdout);
    } catch {
      return null;
    }
  }

  findPidByPort(_port: number): Promise<number | null> {
    // macOS: no /proc filesystem
    return Promise.resolve(null);
  }
}
