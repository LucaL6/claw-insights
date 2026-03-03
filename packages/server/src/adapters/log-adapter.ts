// src/adapters/log-adapter.ts
import type { LogEntry as SharedLogEntry } from '@claw-insights/shared';

import { mapInfraError } from '../ports/error-mapping.js';
import type { LogEntry, LogPort } from '../ports/log-port.js';
import type { ReadContext, Unsubscribe } from '../ports/shared.js';
import type { LogTailer } from '../sources/collectors/log/tailer.js';
import { createSubscriptionHub } from './shared/subscription-hub.js';

const SOURCE = 'log-adapter';

interface TimestampedLogEntry extends LogEntry {
  _capturedAt: number;
}

function mapToLogEntry(entry: SharedLogEntry, capturedAt: number): TimestampedLogEntry {
  return {
    timestamp: capturedAt,
    level: entry.level,
    source: entry.module,
    message: entry.message,
    _capturedAt: capturedAt,
  };
}

export function createLogAdapter(tailer: LogTailer): LogPort & { destroy: () => void } {
  const hub = createSubscriptionHub();
  const enhancedBuffer: TimestampedLogEntry[] = [];
  const BUFFER_SIZE = 200;
  let underlyingAttached = false;

  function ensureAttached(): void {
    if (underlyingAttached) {
      return;
    }

    tailer.on('log', (entry: SharedLogEntry) => {
      const timestamped = mapToLogEntry(entry, Date.now());
      enhancedBuffer.push(timestamped);
      if (enhancedBuffer.length > BUFFER_SIZE) {
        enhancedBuffer.shift();
      }
      hub.trigger();
    });

    const existingEntries = tailer.getRecentEntries(BUFFER_SIZE);
    const now = Date.now();
    for (let i = 0; i < existingEntries.length; i++) {
      const approxTs = now - (existingEntries.length - i) * 100;
      enhancedBuffer.push(mapToLogEntry(existingEntries[i], approxTs));
    }

    underlyingAttached = true;
  }

  function getRecentLogs(limit: number = 50, _context?: ReadContext): LogEntry[] {
    try {
      ensureAttached();
      return enhancedBuffer.slice(-limit).map(({ _capturedAt, ...rest }) => rest);
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function getLogsInRange(start: number, end: number, _context?: ReadContext): LogEntry[] {
    try {
      ensureAttached();
      return enhancedBuffer
        .filter((e) => e._capturedAt >= start && e._capturedAt <= end)
        .map(({ _capturedAt, ...rest }) => rest);
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
    enhancedBuffer.length = 0;
  }

  return { getRecentLogs, getLogsInRange, onChanged, destroy };
}
