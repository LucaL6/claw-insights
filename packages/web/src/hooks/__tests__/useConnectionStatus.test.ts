import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let mockSnap = { sseHealthy: false, everConnected: false, isOffline: false, lastSuccessTs: 0 };
const listeners = new Set<() => void>();

vi.mock('../../lib/connection-health', () => ({
  connectionHealth: {
    getSnapshot: () => mockSnap,
    subscribe: (l: () => void) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  },
}));

import { useConnectionStatus } from '../useConnectionStatus';

function setSnap(partial: Partial<typeof mockSnap>) {
  mockSnap = { ...mockSnap, ...partial };
  act(() => {
    for (const l of listeners) {
      l();
    }
  });
}

describe('useConnectionStatus', () => {
  beforeEach(() => {
    mockSnap = { sseHealthy: false, everConnected: false, isOffline: false, lastSuccessTs: 0 };
  });

  it('returns "connecting" when never connected', () => {
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current).toBe('connecting');
  });

  it('returns "connected" when everConnected and not offline', () => {
    setSnap({ everConnected: true, isOffline: false });
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current).toBe('connected');
  });

  it('returns "reconnecting" when offline', () => {
    setSnap({ everConnected: true, isOffline: true });
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current).toBe('reconnecting');
  });

  it('transitions from connected to reconnecting', () => {
    setSnap({ everConnected: true, isOffline: false });
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current).toBe('connected');
    setSnap({ isOffline: true });
    expect(result.current).toBe('reconnecting');
  });

  it('transitions from reconnecting to connected on recovery', () => {
    setSnap({ everConnected: true, isOffline: true });
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current).toBe('reconnecting');
    setSnap({ isOffline: false });
    expect(result.current).toBe('connected');
  });
});
