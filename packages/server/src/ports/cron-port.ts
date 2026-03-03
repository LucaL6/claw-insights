// src/ports/cron-port.ts
import type { ReadContext, SubscribablePort } from './shared.js';

/**
 * Cron job entry.
 */
export interface CronEntry {
  id: string;
  schedule: string;
  enabled: boolean;
  lastRun: number | null;
  nextRun: number | null;
  description?: string;
}

/**
 * Port contract for cron job data access.
 *
 * Phase 2 - Interface defined but not yet implemented.
 *
 * @consistency eventual
 * @mode sync
 */
export interface CronPort extends SubscribablePort {
  /**
   * Get all cron jobs.
   *
   * @consistency eventual
   * @mode sync
   * @param context - Optional request-level context
   * @returns Array of cron entries
   */
  getCronJobs(context?: ReadContext): CronEntry[];

  /**
   * Get a single cron job by ID.
   *
   * @consistency eventual
   * @mode sync
   * @param id - Cron job identifier
   * @param context - Optional request-level context
   * @returns Cron entry or null if not found
   */
  getCronJobById(id: string, context?: ReadContext): CronEntry | null;
}
