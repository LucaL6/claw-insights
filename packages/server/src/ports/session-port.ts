// src/ports/session-port.ts
import type { Session, SessionSortBy } from '@claw-insights/shared';

import type { ReadContext, SubscribablePort } from './shared.js';

/**
 * Port contract for session data access.
 * Provides read access to session metadata and lifecycle information.
 *
 * @consistency eventual (file-based, no transaction guarantees)
 * @mode sync (returns immediately from in-memory cache)
 */
export interface SessionPort extends SubscribablePort {
  /**
   * Get all sessions, optionally filtered and sorted.
   *
   * @consistency eventual
   * @mode sync
   * @param options - Optional filters and sorting
   * @param context - Optional request-level context for consistent reads
   * @returns Array of sessions
   */
  getSessions(
    options?: { limit?: number; sortBy?: SessionSortBy; activeOnly?: boolean },
    context?: ReadContext,
  ): Session[];

  /**
   * Get a single session by ID.
   *
   * @consistency eventual
   * @mode sync
   * @param sessionId - Session identifier
   * @param context - Optional request-level context
   * @returns Session or null if not found
   */
  getSessionById(sessionId: string, context?: ReadContext): Session | null;

  /**
   * Get sessions created within a date range.
   *
   * @consistency eventual
   * @mode sync
   * @param start - Start timestamp (ISO string or epoch ms)
   * @param end - End timestamp (ISO string or epoch ms)
   * @param context - Optional request-level context
   * @returns Array of sessions in range
   */
  getSessionsInRange(start: string | number, end: string | number, context?: ReadContext): Session[];

  /**
   * Get total session count.
   *
   * @consistency eventual
   * @mode sync
   * @param context - Optional request-level context
   * @returns Total number of sessions
   */
  getSessionCount(context?: ReadContext): number;

  /**
   * Get mapping from internal sessionId (UUID) to external session key.
   * Used by metrics/snapshot paths that aggregate by persisted session id.
   *
   * @consistency eventual
   * @mode sync
   * @param context - Optional request-level context
   * @returns Map of sessionId -> sessionKey
   */
  getSessionIdToKeyMap(context?: ReadContext): Map<string, string>;
}
