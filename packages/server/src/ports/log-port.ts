// src/ports/log-port.ts
import type { ReadContext, SubscribablePort } from './shared.js';

/**
 * Log entry.
 */
export interface LogEntry {
  timestamp: number;
  level: string;
  source: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Port contract for log data access.
 *
 * Phase 2 - Interface defined but not yet implemented.
 *
 * @consistency eventual
 * @mode sync
 */
export interface LogPort extends SubscribablePort {
  /**
   * Get recent log entries.
   *
   * @consistency eventual
   * @mode sync
   * @param limit - Maximum number of entries to return
   * @param context - Optional request-level context
   * @returns Array of log entries
   */
  getRecentLogs(limit?: number, context?: ReadContext): LogEntry[];

  /**
   * Get logs in a time range.
   *
   * @consistency eventual
   * @mode sync
   * @param start - Start timestamp (epoch ms)
   * @param end - End timestamp (epoch ms)
   * @param context - Optional request-level context
   * @returns Array of log entries
   */
  getLogsInRange(start: number, end: number, context?: ReadContext): LogEntry[];
}
