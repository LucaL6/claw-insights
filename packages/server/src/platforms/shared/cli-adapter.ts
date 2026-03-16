// src/platforms/shared/cli-adapter.ts
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { createChildLogger } from '../../logger.js';
import type { CliAdapter } from '../../ports/types.js';

const execFileAsync = promisify(execFile);
const log = createChildLogger('cli-adapter');

const DEFAULT_TIMEOUT_MS = 8_000;
const STATUS_JSON_TIMEOUT_MS = 15_000;

function resolveTimeoutMs(argv: string[]): number {
  return argv[0] === 'status' && argv.includes('--json') ? STATUS_JSON_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;
}

/** Platform-agnostic CLI adapter — same execFile behavior on macOS and Linux. */
export class PosixCliAdapter implements CliAdapter {
  constructor(
    private cliPath: string,
    private env: Record<string, string | undefined>,
  ) {}

  async exec(argv: string[]): Promise<string> {
    try {
      log.debug({ argv }, 'CLI exec');
      const { stdout, stderr: _stderr } = await execFileAsync(this.cliPath, argv, {
        timeout: resolveTimeoutMs(argv),
        encoding: 'utf-8',
        env: this.env,
      });
      log.debug({ argv, stdoutLen: (stdout ?? '').length }, 'CLI exec done');
      return stdout ?? '';
    } catch (err) {
      // Safely extract stderr from ExecFileException (may be string, Buffer, or absent)
      let stderr: string | undefined;
      if (typeof err === 'object' && err !== null && 'stderr' in err) {
        const raw = (err as Record<string, unknown>).stderr;
        if (raw != null) {
          stderr = String(raw);
        }
      }
      log.warn({ err: err instanceof Error ? err : String(err), argv, stderr }, 'CLI call failed');
      return '';
    }
  }
}
