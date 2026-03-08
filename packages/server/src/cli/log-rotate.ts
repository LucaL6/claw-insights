import { createChildLogger } from '../logger.js';
import { type RetentionStats, RetentionSweeper } from '../logging/index.js';

const log = createChildLogger('cli:log-rotate');

export interface LayeredReclaimOptions {
  retentionDays?: number;
  graceHours?: number;
  activeFiles?: Set<string> | string[];
}

/**
 * Layered-mode reclaim path (unified with logging retention logic; no side-channel deletes).
 */
export async function reclaimLayeredLogs(logDir: string, opts: LayeredReclaimOptions = {}): Promise<RetentionStats> {
  const sweeper = new RetentionSweeper({
    logDir,
    retentionDays: opts.retentionDays ?? 14,
    graceHours: opts.graceHours ?? 1,
    sweepIntervalMs: 600_000,
  });

  if (opts.activeFiles) {
    sweeper.setActiveFiles(opts.activeFiles);
  }

  const stats = await sweeper.sweep();
  log.info({ logDir, ...stats }, 'layered log reclaim completed');
  return stats;
}
