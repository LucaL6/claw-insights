// src/ports/usage-port.ts
import type { ReadContext } from './shared.js';

/**
 * Usage cost data.
 * Matches UsageCost from platforms/shared/parsers.ts
 */
export interface UsageCost {
  totalCost: number;
  totalTokensM: number;
  todayCost: number;
  todayTokensM: number;
  fetchedAt: string;
}

/**
 * Port contract for usage cost data access.
 *
 * @consistency eventual
 * @mode async
 */
export interface UsagePort {
  /**
   * Get usage cost information.
   *
   * @consistency eventual
   * @mode async
   * @param context - Optional request-level context
   * @returns Usage cost data
   */
  getUsageCost(context?: ReadContext): Promise<UsageCost>;
}
