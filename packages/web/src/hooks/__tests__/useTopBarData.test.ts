import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseReactiveQuery = vi.fn();
vi.mock('../useReactiveQuery', () => ({
  useReactiveQuery: (...args: unknown[]) => mockUseReactiveQuery(...args),
}));

import { useTopBarData } from '../useTopBarData';

describe('useTopBarData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns version from gateway data', () => {
    mockUseReactiveQuery.mockReturnValueOnce([
      {
        data: { gateway: { appVersion: '0.9.0' } },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { result } = renderHook(() => useTopBarData());
    expect(result.current.version).toBe('0.9.0');
    expect(result.current.fetching.gateway).toBe(false);
  });

  it('handles fetching state (no data yet)', () => {
    mockUseReactiveQuery.mockReturnValueOnce([{ data: undefined, fetching: true, error: null }, vi.fn()]);

    const { result } = renderHook(() => useTopBarData());
    expect(result.current.version).toBe('...');
    expect(result.current.fetching.gateway).toBe(true);
  });

  it('returns fallback version when appVersion is missing', () => {
    mockUseReactiveQuery.mockReturnValueOnce([
      {
        data: { gateway: { appVersion: undefined } },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { result } = renderHook(() => useTopBarData());
    expect(result.current.version).toBe('...');
  });
});
