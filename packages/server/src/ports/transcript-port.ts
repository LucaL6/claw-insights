// src/ports/transcript-port.ts
import type { ReadContext } from './shared.js';

/**
 * Port contract for transcript path resolution.
 *
 * @consistency eventual
 * @mode sync
 */
export interface TranscriptPort {
  /**
   * Get the file path for a session's transcript.
   *
   * @consistency eventual
   * @mode sync
   * @param sessionKey - Session identifier
   * @param context - Optional request-level context
   * @returns Transcript file path or null if not found
   */
  getTranscriptPath(sessionKey: string, context?: ReadContext): string | null;
}
