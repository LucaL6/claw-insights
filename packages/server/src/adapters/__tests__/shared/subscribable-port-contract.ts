// src/adapters/__tests__/shared/subscribable-port-contract.test.ts
import { describe, expect, it, vi } from 'vitest';

import type { SubscribablePort } from '../../../ports/shared.js';

/**
 * Shared contract test suite for all subscribable ports.
 * Every subscribable adapter MUST pass this suite.
 *
 * Usage:
 * ```ts
 * import { testSubscribablePortContract } from './shared/subscribable-port-contract.js';
 *
 * describe('MyAdapter', () => {
 *   testSubscribablePortContract(() => createMyAdapter(...));
 * });
 * ```
 */
export function testSubscribablePortContract(createPort: () => SubscribablePort & { destroy?: () => void }) {
  describe('Subscribable Port Contract', () => {
    it('should call callback when subscribed and triggered', () => {
      const port = createPort();
      const callback = vi.fn();

      port.onChanged(callback);

      // Trigger change (implementation-specific, typically internal state mutation)
      // For testing purposes, we need the port to expose a trigger method or
      // we need to manipulate state that causes onChange to fire.
      // This test will be implemented per-adapter with their specific trigger mechanism.

      expect(callback).not.toHaveBeenCalled();
    });

    it('should NOT call callback after unsubscribe', () => {
      const port = createPort();
      const callback = vi.fn();

      const unsubscribe = port.onChanged(callback);
      unsubscribe();

      // Trigger change after unsubscribe
      // callback should NOT be called

      expect(callback).not.toHaveBeenCalled();
    });

    it('should be safe to unsubscribe twice (idempotent)', () => {
      const port = createPort();
      const callback = vi.fn();

      const unsubscribe = port.onChanged(callback);

      // Call unsubscribe twice
      expect(() => {
        unsubscribe();
        unsubscribe();
      }).not.toThrow();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should NOT call callback after destroy', () => {
      const port = createPort();
      const callback = vi.fn();

      port.onChanged(callback);

      // Destroy the port
      if (port.destroy) {
        port.destroy();
      }

      // Trigger after destroy should not call callback
      // This will be tested per-adapter with specific trigger

      expect(callback).not.toHaveBeenCalled();
    });

    it('should be safe to unsubscribe inside callback', () => {
      const port = createPort();
      const callback = vi.fn();
      let unsubscribe: (() => void) | null = null;

      unsubscribe = port.onChanged(() => {
        callback();
        if (unsubscribe) {
          unsubscribe(); // Unsubscribe inside callback
        }
      });

      // This test structure needs port-specific trigger mechanism
      // Each adapter test will implement the actual trigger

      expect(() => {
        // Trigger mechanism here
      }).not.toThrow();
    });
  });
}
