// src/adapters/__tests__/subscription-hub.test.ts
import { describe, expect, it, vi } from 'vitest';

import { createSubscriptionHub } from '../shared/subscription-hub.js';

describe('SubscriptionHub', () => {
  describe('basic fanout', () => {
    it('should call all subscribers when triggered', () => {
      const hub = createSubscriptionHub();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();

      hub.subscribe(cb1);
      hub.subscribe(cb2);
      hub.subscribe(cb3);

      hub.trigger();

      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
      expect(cb3).toHaveBeenCalledOnce();
    });

    it('should NOT call unsubscribed callbacks', () => {
      const hub = createSubscriptionHub();
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      const unsub1 = hub.subscribe(cb1);
      hub.subscribe(cb2);

      unsub1();
      hub.trigger();

      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).toHaveBeenCalledOnce();
    });
  });

  describe('idempotent unsubscribe', () => {
    it('should allow double unsubscribe without error', () => {
      const hub = createSubscriptionHub();
      const cb = vi.fn();

      const unsub = hub.subscribe(cb);

      expect(() => {
        unsub();
        unsub();
        unsub();
      }).not.toThrow();

      hub.trigger();
      expect(cb).not.toHaveBeenCalled();
    });
  });

  describe('callback-inside unsubscribe safety', () => {
    it('should handle unsubscribe called inside callback without duplicate calls', () => {
      const hub = createSubscriptionHub();
      const cb = vi.fn();
      let unsub: (() => void) | null = null;

      unsub = hub.subscribe(() => {
        cb();
        if (unsub) {
          unsub();
        }
      });

      hub.trigger();
      expect(cb).toHaveBeenCalledOnce();

      // Trigger again - callback should not be called
      hub.trigger();
      expect(cb).toHaveBeenCalledOnce();
    });

    it('should handle multiple callbacks where one unsubscribes itself', () => {
      const hub = createSubscriptionHub();
      const cb1 = vi.fn();
      const cb2 = vi.fn();
      const cb3 = vi.fn();

      let unsub2: (() => void) | null = null;

      hub.subscribe(cb1);
      unsub2 = hub.subscribe(() => {
        cb2();
        if (unsub2) {
          unsub2();
        }
      });
      hub.subscribe(cb3);

      hub.trigger();

      expect(cb1).toHaveBeenCalledOnce();
      expect(cb2).toHaveBeenCalledOnce();
      expect(cb3).toHaveBeenCalledOnce();

      // Second trigger should skip cb2
      hub.trigger();
      expect(cb1).toHaveBeenCalledTimes(2);
      expect(cb2).toHaveBeenCalledOnce(); // No additional call
      expect(cb3).toHaveBeenCalledTimes(2);
    });
  });

  describe('destroy behavior', () => {
    it('should clear all subscriptions on destroy', () => {
      const hub = createSubscriptionHub();
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      hub.subscribe(cb1);
      hub.subscribe(cb2);

      hub.destroy();

      hub.trigger();
      expect(cb1).not.toHaveBeenCalled();
      expect(cb2).not.toHaveBeenCalled();
    });

    it('should make unsubscribe a no-op after destroy', () => {
      const hub = createSubscriptionHub();
      const cb = vi.fn();

      const unsub = hub.subscribe(cb);
      hub.destroy();

      expect(() => {
        unsub();
      }).not.toThrow();
    });
  });

  describe('bridge strategy (single underlying listener)', () => {
    it('should attach underlying listener on first subscriber', () => {
      const onChangeSpy = vi.fn();
      const mockReader = {
        onChange: (fn: () => void) => {
          onChangeSpy(fn);
        },
      };

      const hub = createSubscriptionHub();

      // Simulate bridge strategy: hub manages underlying listener
      let underlyingListener: (() => void) | null = null;
      const bridgeAttach = () => {
        if (underlyingListener) {
          return;
        }
        underlyingListener = () => hub.trigger();
        mockReader.onChange(underlyingListener);
      };

      const cb1 = vi.fn();
      hub.subscribe(cb1);
      bridgeAttach();

      expect(onChangeSpy).toHaveBeenCalledOnce();
      expect(onChangeSpy).toHaveBeenCalledWith(expect.any(Function));
    });

    it('should detach underlying listener when last subscriber unsubscribes', () => {
      const offSpy = vi.fn();
      const mockReader = {
        onChange: vi.fn(),
        off: offSpy,
      };

      const hub = createSubscriptionHub();
      let underlyingListener: (() => void) | null = null;
      let subscriberCount = 0;

      const bridgeSubscribe = (cb: () => void) => {
        const unsub = hub.subscribe(cb);
        subscriberCount++;

        if (subscriberCount === 1) {
          underlyingListener = () => hub.trigger();
          mockReader.onChange(underlyingListener);
        }

        return () => {
          unsub();
          subscriberCount--;
          if (subscriberCount === 0 && underlyingListener) {
            offSpy(underlyingListener);
            underlyingListener = null;
          }
        };
      };

      const unsub1 = bridgeSubscribe(vi.fn());
      const unsub2 = bridgeSubscribe(vi.fn());

      expect(mockReader.onChange).toHaveBeenCalledOnce();

      unsub1();
      expect(offSpy).not.toHaveBeenCalled(); // Still have one subscriber

      unsub2();
      expect(offSpy).toHaveBeenCalledOnce(); // Last subscriber removed
    });

    it('should re-attach when subscribing after 0 subscribers', () => {
      const onChangeSpy = vi.fn();
      const offSpy = vi.fn();
      const mockReader = {
        onChange: onChangeSpy,
        off: offSpy,
      };

      const hub = createSubscriptionHub();
      let underlyingListener: (() => void) | null = null;
      let subscriberCount = 0;

      const bridgeSubscribe = (cb: () => void) => {
        const unsub = hub.subscribe(cb);
        subscriberCount++;

        if (subscriberCount === 1) {
          underlyingListener = () => hub.trigger();
          mockReader.onChange(underlyingListener);
        }

        return () => {
          unsub();
          subscriberCount--;
          if (subscriberCount === 0 && underlyingListener) {
            offSpy(underlyingListener);
            underlyingListener = null;
          }
        };
      };

      const unsub1 = bridgeSubscribe(vi.fn());
      expect(onChangeSpy).toHaveBeenCalledOnce();

      unsub1();
      expect(offSpy).toHaveBeenCalledOnce();
      expect(subscriberCount).toBe(0);

      // Re-subscribe after 0
      bridgeSubscribe(vi.fn());
      expect(onChangeSpy).toHaveBeenCalledTimes(2); // Re-attached
    });
  });

  describe('passive detach (no off method)', () => {
    it('should suppress callbacks after destroy when underlying has no off', () => {
      const hub = createSubscriptionHub();
      const cb = vi.fn();

      // Simulate reader with no off() - hub uses passive detach
      let underlyingCallback: (() => void) | null = null;
      const mockReader = {
        onChange: (fn: () => void) => {
          underlyingCallback = fn;
        },
        // No off() method
      };

      hub.subscribe(cb);
      underlyingCallback = () => hub.trigger();
      mockReader.onChange(underlyingCallback);

      // Simulate underlying reader firing
      underlyingCallback!();
      expect(cb).toHaveBeenCalledOnce();

      // Destroy hub (sets passive detach flag)
      hub.destroy();

      // Underlying reader still fires (no way to detach)
      // But hub should suppress callbacks
      underlyingCallback!();
      expect(cb).toHaveBeenCalledOnce(); // No additional call
    });
  });
});
