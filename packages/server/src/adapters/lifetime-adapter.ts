// src/adapters/lifetime-adapter.ts
import { mapInfraError } from '../ports/error-mapping.js';
import type { LifetimePort, LifetimeStats } from '../ports/lifetime-port.js';
import type { ReadContext } from '../ports/shared.js';
import type { TranscriptManager } from '../sources/collectors/transcript/index.js';

const SOURCE = 'lifetime-adapter';

export function createLifetimeAdapter(transcriptManager: TranscriptManager): LifetimePort & { destroy: () => void } {
  function getStats(_context?: ReadContext): LifetimeStats {
    try {
      return transcriptManager.getStats();
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function isReady(): boolean {
    return transcriptManager.isReady();
  }

  function destroy(): void {
    // No-op: LifetimeAdapter does not own TranscriptManager lifecycle
  }

  return { getStats, isReady, destroy };
}
