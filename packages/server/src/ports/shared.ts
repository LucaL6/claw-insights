// src/ports/shared.ts
import { nanoid } from 'nanoid';

/**
 * Request-level context for consistent reads across multiple port calls.
 * All fields are plain data fields (not getters) to ensure stability.
 */
export interface ReadContext {
  /** Unique request identifier */
  requestId: string;
  /** Timestamp frozen at context creation (milliseconds since epoch) */
  asOfTs: number;
}

/**
 * Create a new ReadContext with a unique request ID and frozen timestamp.
 * The asOfTs field is a plain data field, not a getter, ensuring consistent values.
 */
export function createReadContext(): ReadContext {
  return {
    requestId: nanoid(),
    asOfTs: Date.now(),
  };
}

/**
 * Function to unsubscribe from a subscription.
 * Must be idempotent (safe to call multiple times).
 */
export type Unsubscribe = () => void;

/**
 * Interface for ports that support change subscriptions.
 */
export interface SubscribablePort {
  /**
   * Subscribe to changes. Returns an unsubscribe function.
   * The unsubscribe function must be idempotent.
   *
   * @param callback - Called when data changes
   * @returns Unsubscribe function (idempotent)
   */
  onChanged(callback: () => void): Unsubscribe;
}
