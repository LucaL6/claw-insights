// src/ports/metrics-port.ts
import type { ReadContext, SubscribablePort } from './shared.js';

/**
 * Metrics aggregation result for a time range.
 */
export interface MetricsResult {
  buckets: Array<{
    label: string;
    errors: number;
    warnings: number;
    sessions: number;
    tokens: number;
    apiCalls: number;
    toolCalls: number;
    turns: number;
    userTurns: number;
    assistantTurns: number;
    modelTokens: Array<{ model: string; tokensK: number }>;
  }>;
  totalTokensK: number;
  totalSessions: number;
  totalErrors: number;
  totalWarnings: number;
  uptimePercent: number;
  totalApiCalls: number;
  totalToolCalls: number;
  totalTurns: number;
  range: string;
}

export type MetricsRangeKey = 'THIRTY_MIN' | 'ONE_HOUR' | 'SIX_HOUR' | 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR';

/**
 * Port contract for metrics and aggregated statistics.
 * Provides read access to aggregated metrics from the database.
 *
 * @consistency strong (database-backed with rollup tables)
 * @mode sync (returns immediately with cached data, cache TTL ~60s)
 */
export interface MetricsPort extends SubscribablePort {
  /**
   * Get aggregated metrics for a given date and time range.
   * Results are bucketed by time intervals (e.g., hourly, daily).
   *
   * @consistency strong
   * @mode sync
   * @param date - Optional date string (YYYY-MM-DD), defaults to today
   * @param range - Time range key (THIRTY_MIN, ONE_HOUR, SIX_HOUR, TWELVE_HOUR, TWENTY_FOUR_HOUR)
   * @param context - Optional request-level context
   * @returns Metrics aggregation result
   */
  getMetrics(date?: string, range?: MetricsRangeKey, context?: ReadContext): MetricsResult;

  /**
   * Get token usage for a specific session in a date range.
   *
   * @consistency strong
   * @mode sync
   * @param sessionId - Session identifier
   * @param start - Start timestamp (ISO string)
   * @param end - End timestamp (ISO string)
   * @param context - Optional request-level context
   * @returns Total tokens in thousands (K)
   */
  getSessionTokens(sessionId: string, start: string, end: string, context?: ReadContext): number;

  /**
   * Clear internal cache (useful for testing or forced refresh).
   *
   * @mode sync
   */
  clearCache(): void;
}
