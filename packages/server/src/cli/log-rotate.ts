import { existsSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';

import { createChildLogger } from '../logger.js';

const log = createChildLogger('cli:log-rotate');

interface RotateOptions {
  maxBytes: number; // e.g. 10 * 1024 * 1024 (10MB)
  maxFiles: number; // e.g. 3
}

/**
 * Rotate log file if it exceeds maxBytes.
 * Cascade: server.log → server.log.1 → server.log.2 → ... → drop oldest
 * Returns true if rotation occurred.
 */
export function rotateIfNeeded(logPath: string, opts: RotateOptions): boolean {
  if (!existsSync(logPath)) {
    return false;
  }

  const size = statSync(logPath).size;
  if (size < opts.maxBytes) {
    return false;
  }

  log.info({ logPath, sizeBytes: size, maxBytes: opts.maxBytes }, 'log rotation starting');

  // Drop the oldest if at capacity
  const oldest = `${logPath}.${opts.maxFiles}`;
  if (existsSync(oldest)) {
    unlinkSync(oldest);
  }

  // Cascade: .2 → .3, .1 → .2, etc.
  for (let i = opts.maxFiles - 1; i >= 1; i--) {
    const from = `${logPath}.${i}`;
    const to = `${logPath}.${i + 1}`;
    if (existsSync(from)) {
      renameSync(from, to);
    }
  }

  // Current → .1
  renameSync(logPath, `${logPath}.1`);

  // Create fresh empty log
  writeFileSync(logPath, '');

  log.info({ logPath }, 'log rotation completed');
  return true;
}

/** Default rotation options: 10MB, keep 3 history files */
export const DEFAULT_ROTATE_OPTIONS: RotateOptions = {
  maxBytes: 10 * 1024 * 1024,
  maxFiles: 3,
};
