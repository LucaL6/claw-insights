import { useEffect, useReducer, useRef } from 'react';

// ── State Machine (exported for unit testing) ──

export type RetryPhase = 'idle' | 'scheduled' | 'deferred';

export interface RetryState {
  phase: RetryPhase;
  attempt: number;
}

export type RetryAction =
  | { type: 'tick' } // retry fired → increment attempt, go to scheduled
  | { type: 'defer' } // timer fired while hidden → wait for visibility
  | { type: 'reset' }; // deactivated → back to idle

export const RETRY_INIT: RetryState = { phase: 'idle', attempt: 0 };

export function retryReducer(state: RetryState, action: RetryAction): RetryState {
  switch (action.type) {
    case 'tick':
      return { phase: 'scheduled', attempt: state.attempt + 1 };
    case 'defer':
      return state.phase === 'deferred' || state.phase === 'idle' ? state : { ...state, phase: 'deferred' };
    case 'reset':
      return RETRY_INIT; // same ref → React bailout if already idle
  }
}

// ── Hook ──

/**
 * Retry with exponential backoff + visibility gate.
 *
 * Uses an explicit state machine (useReducer) with three phases:
 * - idle: inactive, no timer
 * - scheduled: timer running, waiting to fire
 * - deferred: timer fired while tab hidden, waiting for visibility
 *
 * The `attempt` counter in state drives effect re-entry:
 * dispatch(tick) → attempt++ → state change → effect re-runs → new timer.
 */
export function useRetryWithBackoff(
  active: boolean,
  onRetry: () => void,
  { baseMs = 5_000, maxMs = 30_000 } = {},
): void {
  const [state, dispatch] = useReducer(retryReducer, RETRY_INIT);
  const onRetryRef = useRef(onRetry);
  useEffect(() => {
    onRetryRef.current = onRetry;
  });

  useEffect(() => {
    if (!active) {
      if (state.phase !== 'idle') {dispatch({ type: 'reset' });}
      return;
    }

    // idle → kick off the first schedule
    if (state.phase === 'idle') {
      dispatch({ type: 'tick' }); // → scheduled, attempt 1
      return;
    }

    // scheduled → set timer with backoff delay
    if (state.phase === 'scheduled') {
      const delay = Math.min(baseMs * Math.pow(2, state.attempt - 1), maxMs);
      const id = setTimeout(() => {
        if (document.visibilityState === 'visible') {
          onRetryRef.current();
          dispatch({ type: 'tick' }); // → scheduled, attempt+1
        } else {
          dispatch({ type: 'defer' }); // → deferred
        }
      }, delay);
      return () => { clearTimeout(id); };
    }

    // deferred → listen for visibility restore
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- exhaustive phase guard
    if (state.phase === 'deferred') {
      const onVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
          onRetryRef.current();
          dispatch({ type: 'tick' }); // → scheduled, attempt+1
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);
      return () => { document.removeEventListener('visibilitychange', onVisibilityChange); };
    }
  }, [active, state.phase, state.attempt, baseMs, maxMs]);
}
