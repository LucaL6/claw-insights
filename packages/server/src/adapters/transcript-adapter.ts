// src/adapters/transcript-adapter.ts
import { mapInfraError } from '../ports/error-mapping.js';
import type { ReadContext } from '../ports/shared.js';
import type { TranscriptPort } from '../ports/transcript-port.js';
import type { SessionReader } from '../sources/readers/session-reader.js';

const SOURCE = 'transcript-adapter';

export function createTranscriptAdapter(sessionReader: SessionReader): TranscriptPort & { destroy: () => void } {
  function getTranscriptPath(sessionKey: string, _context?: ReadContext): string | null {
    try {
      return sessionReader.getTranscriptPath(sessionKey);
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function destroy(): void {
    // No-op: TranscriptAdapter does not own SessionReader lifecycle
  }

  return { getTranscriptPath, destroy };
}
