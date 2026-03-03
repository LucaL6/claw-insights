// src/adapters/__tests__/session-adapter.test.ts
import type { Session } from '@claw-insights/shared';
import { describe, expect, it, vi } from 'vitest';

import { createSessionAdapter } from '../session-adapter.js';
import { testSubscribablePortContract } from './shared/subscribable-port-contract.js';

describe('SessionAdapter', () => {
  // Mock SessionReader
  function createMockReader() {
    const listeners: Array<() => void> = [];
    const sessions = new Map<string, Session>();

    return {
      getSessions: vi.fn(() => Array.from(sessions.values())),
      getSession: vi.fn((key: string) => sessions.get(key)),
      getSessionIdToKeyMap: vi.fn(() => new Map<string, string>()),
      onChange: vi.fn((fn: () => void) => {
        listeners.push(fn);
      }),
      destroy: vi.fn(),
      // Test helpers
      _sessions: sessions,
      _trigger: () => {
        for (const fn of listeners) {
          fn();
        }
      },
    };
  }

  describe('basic port contract', () => {
    it('should return sessions from reader', () => {
      const reader = createMockReader();
      const session: Session = {
        key: 'agent:main:test',
        displayName: 'test',
        kind: 'direct',
        model: 'claude-4',
        channel: null,
        totalTokens: 1000,
        contextTokens: 200000,
        usagePercent: 0.5,
        status: 'ACTIVE',
        updatedAt: Date.now(),
        turnCount: 5,
        subAgents: [],
      };

      reader._sessions.set(session.key, session);

      const adapter = createSessionAdapter(reader as any);
      const result = adapter.getSessions();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(session);
      expect(reader.getSessions).toHaveBeenCalledOnce();
    });

    it('should return session by id', () => {
      const reader = createMockReader();
      const session: Session = {
        key: 'agent:main:test',
        displayName: 'test',
        kind: 'direct',
        model: 'claude-4',
        channel: null,
        totalTokens: 1000,
        contextTokens: 200000,
        usagePercent: 0.5,
        status: 'ACTIVE',
        updatedAt: Date.now(),
        turnCount: 5,
        subAgents: [],
      };

      reader._sessions.set(session.key, session);

      const adapter = createSessionAdapter(reader as any);
      const result = adapter.getSessionById('agent:main:test');

      expect(result).toEqual(session);
      expect(reader.getSession).toHaveBeenCalledWith('agent:main:test');
    });

    it('should return null for non-existent session', () => {
      const reader = createMockReader();
      const adapter = createSessionAdapter(reader as any);

      const result = adapter.getSessionById('nonexistent');

      expect(result).toBeNull();
    });

    it('should return session id to key map', () => {
      const reader = createMockReader();
      const map = new Map([
        ['uuid-1', 'agent:main:main'],
        ['uuid-2', 'agent:main:subagent:1'],
      ]);
      reader.getSessionIdToKeyMap.mockReturnValue(map);

      const adapter = createSessionAdapter(reader as any);
      const result = adapter.getSessionIdToKeyMap();

      expect(result).toBe(map);
      expect(reader.getSessionIdToKeyMap).toHaveBeenCalledOnce();
    });
  });

  describe('error mapping', () => {
    it('should map ENOENT to NOT_FOUND', () => {
      const reader = {
        getSession: vi.fn(() => {
          const err = new Error('File not found') as Error & { code: string };
          err.code = 'ENOENT';
          throw err;
        }),
        getSessions: vi.fn(),
        onChange: vi.fn(),
        destroy: vi.fn(),
      };

      const adapter = createSessionAdapter(reader as any);

      expect(() => adapter.getSessionById('test')).toThrow();

      try {
        adapter.getSessionById('test');
      } catch (err: any) {
        expect(err.code).toBe('NOT_FOUND');
        expect(err.source).toBe('session-adapter');
        expect(err.retriable).toBe(false);
      }
    });
  });

  describe('subscription contract', () => {
    testSubscribablePortContract(() => {
      const reader = createMockReader();
      return createSessionAdapter(reader as any);
    });

    it('should call subscriber when reader triggers onChange', () => {
      const reader = createMockReader();
      const adapter = createSessionAdapter(reader as any);

      const callback = vi.fn();
      adapter.onChanged(callback);

      expect(callback).not.toHaveBeenCalled();

      // Trigger underlying reader
      reader._trigger();

      expect(callback).toHaveBeenCalledOnce();
    });

    it('should NOT call subscriber after unsubscribe', () => {
      const reader = createMockReader();
      const adapter = createSessionAdapter(reader as any);

      const callback = vi.fn();
      const unsubscribe = adapter.onChanged(callback);

      unsubscribe();
      reader._trigger();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple subscribers', () => {
      const reader = createMockReader();
      const adapter = createSessionAdapter(reader as any);

      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();

      adapter.onChanged(cb1);
      adapter.onChanged(cb2);
      adapter.onChanged(cb3);

      reader._trigger();

      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
      expect(cb3).toHaveBeenCalledOnce();
    });
  });

  describe('bridge strategy', () => {
    it('should attach underlying onChange only once', () => {
      const reader = createMockReader();
      const adapter = createSessionAdapter(reader as any);

      adapter.onChanged(vi.fn());
      adapter.onChanged(vi.fn());
      adapter.onChanged(vi.fn());

      // Should only register one underlying listener
      expect(reader.onChange).toHaveBeenCalledOnce();
    });

    it('should NOT detach when last subscriber unsubscribes (passive detach)', () => {
      const reader = createMockReader();
      const adapter = createSessionAdapter(reader as any);

      const unsub1 = adapter.onChanged(vi.fn());
      const unsub2 = adapter.onChanged(vi.fn());

      // SessionReader has no off() method, so adapter uses passive detach
      unsub1();
      unsub2();

      // Underlying reader will still trigger, but adapter suppresses callbacks
      const cb3 = vi.fn();
      adapter.onChanged(cb3);

      // Should reuse existing listener (no new onChange call)
      expect(reader.onChange).toHaveBeenCalledOnce();
    });

    it('should suppress callbacks after all unsubscribe (passive detach)', () => {
      const reader = createMockReader();
      const adapter = createSessionAdapter(reader as any);

      const cb = vi.fn();
      const unsub = adapter.onChanged(cb);

      reader._trigger();
      expect(cb).toHaveBeenCalledOnce();

      unsub();

      // Trigger again - should not call callback
      reader._trigger();
      expect(cb).toHaveBeenCalledOnce();
    });
  });

  describe('destroy behavior', () => {
    it('should clear all subscriptions on destroy', () => {
      const reader = createMockReader();
      const adapter = createSessionAdapter(reader as any);

      const cb = vi.fn();
      adapter.onChanged(cb);

      adapter.destroy();

      reader._trigger();
      expect(cb).not.toHaveBeenCalled();
    });

    it('should NOT call reader.destroy on adapter destroy', () => {
      const reader = createMockReader();
      const adapter = createSessionAdapter(reader as any);

      adapter.destroy();

      expect(reader.destroy).not.toHaveBeenCalled();
    });
  });
});
