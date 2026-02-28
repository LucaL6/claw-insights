// src/platforms/shared/cli-adapter.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { createChildLogger } from '../../logger.js';
import type { CliAdapter } from '../../ports/types.js';

const execFileAsync = promisify(execFile);
const log = createChildLogger('cli-adapter');

/** Platform-agnostic CLI adapter — same execFile behavior on macOS and Linux. */
export class PosixCliAdapter implements CliAdapter {
  constructor(
    private cliPath: string,
    private env: Record<string, string | undefined>,
  ) {}

  async exec(argv: string[]): Promise<string> {
    try {
      log.info({ cliPath: this.cliPath, argv }, 'CLI exec start');
      const { stdout, stderr } = await execFileAsync(this.cliPath, argv, {
        timeout: 8000,
        encoding: 'utf-8',
        env: this.env,
      });
      log.info({ argv, stdoutLen: stdout.length, stderrLen: stderr.length }, 'CLI exec done');
      return stdout;
    } catch (err) {
      log.warn({ err: err as Error, argv }, 'CLI call failed');
      return '';
    }
  }
}
