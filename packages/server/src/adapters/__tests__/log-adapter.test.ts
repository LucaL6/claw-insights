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

    it('should handle invalid limit values gracefully', () => {
      const tailer = new MockLogTailer([
        mkSharedLog({ message: '1' }),
        mkSharedLog({ message: '2' }),
        mkSharedLog({ message: '3' }),
      ]);
      const adapter = createLogAdapter(tailer as any);

      // NaN should fallback to default 50
      expect(adapter.getRecentLogs(NaN)).toHaveLength(3);

      // Negative should fallback to default 50
      expect(adapter.getRecentLogs(-1)).toHaveLength(3);

      // Zero should fallback to default 50
      expect(adapter.getRecentLogs(0)).toHaveLength(3);

      // Infinity should fallback to default 50
      expect(adapter.getRecentLogs(Infinity)).toHaveLength(3);

      // Decimal should be floored
      expect(adapter.getRecentLogs(1.9)).toHaveLength(1);
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
      expect(adapter.getRecentLogs(500)).toHaveLength(0);
    });
  });

  describe('listener cleanup', () => {
    it('should detach tailer listener on destroy', () => {
      const tailer = new MockLogTailer([mkSharedLog({ message: 'seed' })]);
      const adapter = createLogAdapter(tailer as any);

      // Force attach by reading logs
      adapter.getRecentLogs();

      // Verify listener is attached
      expect(tailer.listenerCount('log')).toBe(1);

      adapter.destroy();

      // Listener should be detached
      expect(tailer.listenerCount('log')).toBe(0);
    });

    it('should not add to buffer after destroy', () => {
      const tailer = new MockLogTailer([mkSharedLog({ message: 'seed' })]);
      const adapter = createLogAdapter(tailer as any);

      adapter.getRecentLogs(); // attach
      adapter.destroy();

      tailer.emitLog(mkSharedLog({ message: 'post-destroy' }));

      // Buffer should stay empty (was cleared by destroy)
      expect(adapter.getRecentLogs(500)).toHaveLength(0);
    });

    it('should be idempotent on multiple destroy calls', () => {
      const tailer = new MockLogTailer();
      const adapter = createLogAdapter(tailer as any);
      adapter.getRecentLogs();

      expect(() => {
        adapter.destroy();
        adapter.destroy();
        adapter.destroy();
      }).not.toThrow();

      expect(tailer.listenerCount('log')).toBe(0);
    });
  });

  describe('race condition handling', () => {
    it('should deduplicate entries from hydration and listener', () => {
      // Scenario: tailer already has 'existing' in its buffer
      // When we attach, we get it from hydration
      // The dedup should prevent exact duplicates
      const tailer = new MockLogTailer([mkSharedLog({ message: 'existing', level: 'INFO', module: 'test' })]);
      const adapter = createLogAdapter(tailer as any);

      const firstRead = adapter.getRecentLogs();
      expect(firstRead).toHaveLength(1);
      expect(firstRead[0].message).toBe('existing');

      // Emit a DIFFERENT log - should be added
      tailer.emitLog(mkSharedLog({ message: 'new-entry', level: 'INFO', module: 'test' }));

      const secondRead = adapter.getRecentLogs();
      expect(secondRead).toHaveLength(2);
      expect(secondRead.map((l) => l.message)).toEqual(['existing', 'new-entry']);
    });

    it('should capture entries emitted before first read via tailer buffer', () => {
      const tailer = new MockLogTailer();
      const adapter = createLogAdapter(tailer as any);

      // Emit before first read - MockLogTailer stores in its internal entries
      tailer.emitLog(mkSharedLog({ message: 'before-attach' }));

      // First read triggers attach + hydration from tailer's buffer
      const logs = adapter.getRecentLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('before-attach');
    });

    it('should not deduplicate entries with same content but different times', () => {
      const tailer = new MockLogTailer([
        mkSharedLog({ message: 'repeat', time: '12:00:00.000' }),
        mkSharedLog({ message: 'repeat', time: '12:00:01.000' }),
      ]);
      const adapter = createLogAdapter(tailer as any);

      const logs = adapter.getRecentLogs();

      expect(logs).toHaveLength(2);
      expect(logs.map((l) => l.message)).toEqual(['repeat', 'repeat']);
    });

    it('should preserve hydration-internal natural duplicates with same time', () => {
      const tailer = new MockLogTailer([
        mkSharedLog({ message: 'dup', time: '12:00:00.000', level: 'WARN', module: 'core' }),
        mkSharedLog({ message: 'dup', time: '12:00:00.000', level: 'WARN', module: 'core' }),
        mkSharedLog({ message: 'dup', time: '12:00:00.000', level: 'WARN', module: 'core' }),
      ]);
      const adapter = createLogAdapter(tailer as any);

      const logs = adapter.getRecentLogs();

      expect(logs).toHaveLength(3);
      expect(logs.every((l) => l.message === 'dup')).toBe(true);
    });
  });
});
