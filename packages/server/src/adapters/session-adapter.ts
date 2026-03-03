// src/adapters/session-adapter.ts
import type { Session, SessionSortBy } from '@claw-insights/shared';

import { mapInfraError } from '../ports/error-mapping.js';
import type { SessionPort } from '../ports/session-port.js';
import type { ReadContext, Unsubscribe } from '../ports/shared.js';
import type { SessionReader } from '../sources/readers/session-reader.js';
import { createSubscriptionHub } from './shared/subscription-hub.js';

const SOURCE = 'session-adapter';

/**
 * Create a SessionPort adapter that wraps SessionReader.
 *
 * Bridge strategy: SessionReader has onChange(fn) but no unsubscribe.
 * We use a single underlying listener with hub-based fanout.
 * Passive detach: after all unsubscribe, we can't detach from reader,
 * so we set a flag to suppress callbacks.
 *
 * @param reader - SessionReader instance
 * @returns SessionPort implementation
 */
export function createSessionAdapter(reader: SessionReader): SessionPort & { destroy: () => void } {
  const hub = createSubscriptionHub();
  let underlyingAttached = false;

  // Attach underlying listener on first subscription
  function ensureAttached(): void {
    if (underlyingAttached) {
      return;
    }

    reader.onChange(() => {
      hub.trigger();
    });

    underlyingAttached = true;
  }

  function getSessions(
    options?: { limit?: number; sortBy?: SessionSortBy; activeOnly?: boolean },
    _context?: ReadContext,
  ): Session[] {
    try {
      const filter = options
        ? {
            activeOnly: options.activeOnly ?? false,
            sortBy: options.sortBy,
          }
        : undefined;

      const sessions = reader.getSessions(filter);

      if (options?.limit) {
        return sessions.slice(0, options.limit);
      }

      return sessions;
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function getSessionById(sessionId: string, _context?: ReadContext): Session | null {
    try {
      const session = reader.getSession(sessionId);
      return session ?? null;
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function getSessionsInRange(start: string | number, end: string | number, _context?: ReadContext): Session[] {
    try {
      const startMs = typeof start === 'string' ? new Date(start).getTime() : start;
      const endMs = typeof end === 'string' ? new Date(end).getTime() : end;

      const allSessions = reader.getSessions();
      return allSessions.filter((s) => s.updatedAt >= startMs && s.updatedAt <= endMs);
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function getSessionCount(_context?: ReadContext): number {
    try {
      const sessions = reader.getSessions();
      return sessions.length;
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function getSessionIdToKeyMap(_context?: ReadContext): Map<string, string> {
    try {
      return reader.getSessionIdToKeyMap();
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function onChanged(callback: () => void): Unsubscribe {
    ensureAttached();
    return hub.subscribe(callback);
  }

  function destroy(): void {
    hub.destroy();
  }

  return {
    getSessions,
    getSessionById,
    getSessionsInRange,
    getSessionCount,
    getSessionIdToKeyMap,
    onChanged,
    destroy,
  };
}
