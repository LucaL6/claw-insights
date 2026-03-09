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

  it('returns version from system gateway data', () => {
    mockUseReactiveQuery.mockReturnValueOnce([
      {
        data: { system: { __typename: 'OpenClawSystem', gateway: { appVersion: '0.1.0' } } },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { result } = renderHook(() => useTopBarData());
    expect(result.current.version).toBe('0.1.0');
    expect(result.current.fetching.gateway).toBe(false);
  });

  it('handles fetching state (no data yet)', () => {
    mockUseReactiveQuery.mockReturnValueOnce([{ data: undefined, fetching: true, error: null }, vi.fn()]);

    const { result } = renderHook(() => useTopBarData());
    expect(result.current.version).toBe('...');
    expect(result.current.fetching.gateway).toBe(true);
  });

  it('returns fallback version when system is null', () => {
    mockUseReactiveQuery.mockReturnValueOnce([
      {
        data: { system: null },
        fetching: false,
        error: null,
      },
      vi.fn(),
    ]);

    const { result } = renderHook(() => useTopBarData());
    expect(result.current.version).toBe('...');
  });
});
