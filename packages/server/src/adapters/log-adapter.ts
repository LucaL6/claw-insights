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
  _originalTime?: string;
}

function mapToLogEntry(entry: SharedLogEntry, capturedAt: number): TimestampedLogEntry {
  return {
    timestamp: capturedAt,
    level: entry.level,
    source: entry.module,
    message: entry.message,
    _capturedAt: capturedAt,
    _originalTime: entry.time,
  };
}

export function createLogAdapter(tailer: LogTailer): LogPort & { destroy: () => void } {
  const hub = createSubscriptionHub();
  const enhancedBuffer: TimestampedLogEntry[] = [];
  const BUFFER_SIZE = 200;
  let underlyingAttached = false;
  let destroyed = false;
  let logHandler: ((entry: SharedLogEntry) => void) | null = null;

  function pushToBuffer(entry: SharedLogEntry, capturedAt: number): void {
    if (destroyed) {
      return;
    }
    const timestamped = mapToLogEntry(entry, capturedAt);
    enhancedBuffer.push(timestamped);
    if (enhancedBuffer.length > BUFFER_SIZE) {
      enhancedBuffer.shift();
    }
  }

  function entryKey(entry: SharedLogEntry): string {
    return `${entry.time}|${entry.level}|${entry.module}|${entry.message}`;
  }

  function bufferedEntryKey(entry: TimestampedLogEntry): string {
    return `${entry._originalTime ?? ''}|${entry.level}|${entry.source}|${entry.message}`;
  }

  function ensureAttached(): void {
    if (underlyingAttached || destroyed) {
      return;
    }

    // Attach first to avoid missing events during hydration.
    logHandler = (entry: SharedLogEntry) => {
      pushToBuffer(entry, Date.now());
      hub.trigger();
    };
    tailer.on('log', logHandler);
    underlyingAttached = true;

    // Hydrate historical data, deduplicating ONLY against entries already captured
    // by the live listener (the overlap window). Do NOT dedup within hydration data
    // itself — natural duplicates from the source must be preserved.
    const existingEntries = tailer.getRecentEntries(BUFFER_SIZE);
    const liveKeys = new Set(enhancedBuffer.map((e) => bufferedEntryKey(e)));
    const now = Date.now();
    for (let i = 0; i < existingEntries.length; i++) {
      const entry = existingEntries[i];
      const key = entryKey(entry);
      // Only skip if this entry was already captured by the live listener
      if (liveKeys.has(key)) {
        // Remove from liveKeys so that if the same key appears again in hydration,
        // subsequent natural duplicates are NOT skipped.
        liveKeys.delete(key);
        continue;
      }
      const approxTs = now - (existingEntries.length - i) * 100;
      pushToBuffer(entry, approxTs);
    }
  }

  function getRecentLogs(limit: number = 50, _context?: ReadContext): LogEntry[] {
    try {
      ensureAttached();
      const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 50;
      return enhancedBuffer.slice(-safeLimit).map(({ _capturedAt, _originalTime, ...rest }) => rest);
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function getLogsInRange(start: number, end: number, _context?: ReadContext): LogEntry[] {
    try {
      ensureAttached();
      return enhancedBuffer
        .filter((e) => e._capturedAt >= start && e._capturedAt <= end)
        .map(({ _capturedAt, _originalTime, ...rest }) => rest);
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function onChanged(callback: () => void): Unsubscribe {
    ensureAttached();
    return hub.subscribe(callback);
  }

  function destroy(): void {
    if (destroyed) {
      return;
    }
    destroyed = true;
    if (logHandler) {
      tailer.off('log', logHandler);
      logHandler = null;
    }
    hub.destroy();
    enhancedBuffer.length = 0;
  }

  return { getRecentLogs, getLogsInRange, onChanged, destroy };
}
