// src/ports/system-port.ts
import type { ReadContext } from './shared.js';

/**
 * System metrics snapshot.
 */
export interface SystemMetrics {
  cpu: number;
  memoryMB: number;
  diskMB: number;
  uptime: string;
  platform: string;
  nodeVersion: string;
}

/**
 * Port contract for system information access.
 *
 * Phase 2 - Interface defined but not yet implemented.
 *
 * @consistency eventual
 * @mode async
 */
export interface SystemPort {
  /**
   * Get current system metrics.
   *
   * @consistency eventual
   * @mode async
   * @timeoutMs 2000
   * @param context - Optional request-level context
   * @returns System metrics snapshot
   */
  getSystemMetrics(context?: ReadContext): Promise<SystemMetrics>;

  /**
   * Get process-specific metrics for a given PID.
   *
   * @consistency eventual
   * @mode async
   * @timeoutMs 1000
   * @param pid - Process ID
   * @param context - Optional request-level context
   * @returns Process metrics or null if not found
   */
  getProcessMetrics(pid: number, context?: ReadContext): Promise<{ cpu: number; memoryMB: number } | null>;
}
