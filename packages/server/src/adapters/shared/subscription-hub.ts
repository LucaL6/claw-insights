// src/adapters/shared/subscription-hub.ts
import type { Unsubscribe } from '../../ports/shared.js';

/**
 * Subscription hub for managing multiple subscribers with fanout notification.
 * Provides idempotent unsubscribe and safe callback-inside-unsubscribe handling.
 */
export interface SubscriptionHub {
  subscribe(callback: () => void): Unsubscribe;
  trigger(): void;
  destroy(): void;
}

/**
 * Create a subscription hub.
 */
export function createSubscriptionHub(): SubscriptionHub {
  const subscribers = new Set<() => void>();
  let destroyed = false;

  function subscribe(callback: () => void): Unsubscribe {
    if (destroyed) {
      // After destroy, subscriptions are no-op
      return () => {};
    }

    subscribers.add(callback);

    let unsubscribed = false;

    return () => {
      // Idempotent: can be called multiple times safely
      if (unsubscribed || destroyed) {
        return;
      }
      unsubscribed = true;
      subscribers.delete(callback);
    };
  }

  function trigger(): void {
    if (destroyed) {
      return;
    }

    // Create a snapshot of current subscribers to handle callback-inside-unsubscribe safely
    // This prevents modification during iteration
    const snapshot = Array.from(subscribers);

    for (const callback of snapshot) {
      // Check if still subscribed (might have been removed during iteration)
      if (subscribers.has(callback)) {
        callback();
      }
    }
  }

  function destroy(): void {
    destroyed = true;
    subscribers.clear();
  }

  return {
    subscribe,
    trigger,
    destroy,
  };
}
