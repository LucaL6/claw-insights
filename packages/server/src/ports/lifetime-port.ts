// src/ports/lifetime-port.ts
import type { ReadContext } from './shared.js';

/**
 * Lifetime statistics data.
 * Matches LifetimeStatsResult from transcript/persistence/lifetime-stats.ts
 */
export interface LifetimeStats {
  isReady: boolean;
  createdAt: string;
  daysSinceCreation: number;
  totalSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheReadTokens: number;
  totalCacheWriteTokens: number;
  totalTokens: number;
  totalUserMessages: number;
  totalAssistantMessages: number;
}

/**
 * Port contract for lifetime statistics access.
 *
 * @consistency eventual
 * @mode sync
 */
export interface LifetimePort {
  /**
   * Get lifetime statistics.
   *
   * @consistency eventual
   * @mode sync
   * @param context - Optional request-level context
   * @returns Lifetime statistics
   */
  getStats(context?: ReadContext): LifetimeStats;

  /**
   * Check if lifetime scanner is ready.
   * @mode sync
   */
  isReady(): boolean;
}
