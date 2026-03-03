// src/adapters/__tests__/log-adapter.test.ts
import type { LogEntry as SharedLogEntry } from '@claw-insights/shared';
import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';

import { createLogAdapter } from '../log-adapter.js';
import { testSubscribablePortContract } from './shared/subscribable-port-contract.js';

class MockLogTailer extends EventEmitter {
  private entries: SharedLogEntry[] = [];

  constructor(initialEntries: SharedLogEntry[] = []) {
    super();
    this.entries = [...initialEntries];
  }

  getRecentEntries(count: number = 50): SharedLogEntry[] {
    return this.entries.slice(-count);
  }

  emitLog(entry: SharedLogEntry): void {
    this.entries.push(entry);
    this.emit('log', entry);
  }
}

function mkSharedLog(partial: Partial<SharedLogEntry> = {}): SharedLogEntry {
  return {
    time: partial.time ?? '12:00:00.000',
    level: partial.level ?? 'INFO',
    module: partial.module ?? 'system',
    message: partial.message ?? 'hello',
  };
}

describe('LogAdapter', () => {
  describe('basic port contract', () => {
    it('should return mapped recent logs with default limit', () => {
      const tailer = new MockLogTailer([
        mkSharedLog({ level: 'INFO', module: 'agent', message: 'a' }),
        mkSharedLog({ level: 'WARN', module: 'tools', message: 'b' }),
      ]);

      const adapter = createLogAdapter(tailer as any);
      const result = adapter.getRecentLogs();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        level: 'INFO',
        source: 'agent',
        message: 'a',
      });
      expect(result[0]).toHaveProperty('timestamp');
      expect((result[0] as any)._capturedAt).toBeUndefined();
      expect(result[1]).toMatchObject({
        level: 'WARN',
        source: 'tools',
        message: 'b',
      });
    });

    it('should respect explicit limit', () => {
      const tailer = new MockLogTailer([
        mkSharedLog({ message: '1' }),
        mkSharedLog({ message: '2' }),
        mkSharedLog({ message: '3' }),
      ]);

      const adapter = createLogAdapter(tailer as any);
      const result = adapter.getRecentLogs(2);

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.message)).toEqual(['2', '3']);
    });
  });

  describe('getLogsInRange', () => {
    it('should filter by captured timestamp range', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-04T00:00:00.000Z'));

      const tailer = new MockLogTailer();
      const adapter = createLogAdapter(tailer as any);

      // Attach listener
      adapter.getRecentLogs();

      const t1 = Date.now();
      tailer.emitLog(mkSharedLog({ message: 'early' }));

      vi.setSystemTime(new Date(t1 + 1000));
      const t2 = Date.now();
      tailer.emitLog(mkSharedLog({ message: 'middle' }));

      vi.setSystemTime(new Date(t2 + 1000));
      const t3 = Date.now();
      tailer.emitLog(mkSharedLog({ message: 'late' }));

      const onlyMiddle = adapter.getLogsInRange(t2, t2);
      expect(onlyMiddle).toHaveLength(1);
      expect(onlyMiddle[0].message).toBe('middle');

      const middleAndLate = adapter.getLogsInRange(t2, t3);
      expect(middleAndLate.map((e) => e.message)).toEqual(['middle', 'late']);

      vi.useRealTimers();
    });
  });

  describe('subscription contract', () => {
    testSubscribablePortContract(() => {
      const tailer = new MockLogTailer();
      return createLogAdapter(tailer as any);
    });

    it('should notify subscriber on new log', () => {
      const tailer = new MockLogTailer();
      const adapter = createLogAdapter(tailer as any);

      const cb = vi.fn();
      adapter.onChanged(cb);

      tailer.emitLog(mkSharedLog({ message: 'new' }));

      expect(cb).toHaveBeenCalledOnce();
    });

    it('should not notify after unsubscribe', () => {
      const tailer = new MockLogTailer();
      const adapter = createLogAdapter(tailer as any);

      const cb = vi.fn();
      const unsub = adapter.onChanged(cb);
      unsub();

      tailer.emitLog(mkSharedLog({ message: 'new' }));

      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('buffer management', () => {
    it('should keep at most 200 entries', () => {
      const tailer = new MockLogTailer();
      const adapter = createLogAdapter(tailer as any);

      // Attach
      adapter.getRecentLogs();

      for (let i = 0; i < 210; i++) {
        tailer.emitLog(mkSharedLog({ message: `msg-${i}` }));
      }

      const all = adapter.getRecentLogs(500);

      expect(all).toHaveLength(200);
      expect(all[0].message).toBe('msg-10');
      expect(all[199].message).toBe('msg-209');
    });
  });

  describe('destroy behavior', () => {
    it('should clear subscriptions and buffer on destroy', () => {
      const tailer = new MockLogTailer([mkSharedLog({ message: 'seed' })]);
      const adapter = createLogAdapter(tailer as any);

      const cb = vi.fn();
      adapter.onChanged(cb);

      adapter.destroy();

      tailer.emitLog(mkSharedLog({ message: 'post-destroy' }));

      expect(cb).not.toHaveBeenCalled();
      expect(adapter.getRecentLogs(500)).toHaveLength(1);
      expect(adapter.getRecentLogs(500)[0].message).toBe('post-destroy');
    });
  });
});
