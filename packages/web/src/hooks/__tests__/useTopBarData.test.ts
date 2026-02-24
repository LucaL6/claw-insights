import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const mockUseReactiveQuery = vi.fn();
vi.mock('../useReactiveQuery', () => ({
  useReactiveQuery: (...args: unknown[]) => mockUseReactiveQuery(...args),
}));

import { useTopBarData } from '../useTopBarData';

describe('useTopBarData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns computed fields from gateway data', () => {
    const startedAt = new Date(Date.now() - 3_600_000 * 2).toISOString(); // 2h ago
    mockUseReactiveQuery
      .mockReturnValueOnce([
        {
          data: { gateway: { version: '1.2.3', appVersion: '0.1.0', latestVersion: '1.2.5', startedAt } },
          fetching: false,
          error: null,
        },
        vi.fn(),
      ])
      .mockReturnValueOnce([
        {
          data: { resources: { cpu: 10 } },
          fetching: false,
          error: null,
        },
        vi.fn(),
      ])
      .mockReturnValueOnce([
        {
          data: { channels: [{ provider: 'discord', name: 'Discord', connected: true }] },
          fetching: false,
          error: null,
        },
        vi.fn(),
      ]);

    const { result } = renderHook(() => useTopBarData());
    expect(result.current.version).toBe('0.1.0');
    expect(result.current.uptime).toMatch(/\d+h \d+m/);
    expect(result.current.channels).toHaveLength(1);
    expect(result.current.fetching.gateway).toBe(false);
  });

  it('handles fetching state (no data yet)', () => {
    mockUseReactiveQuery
      .mockReturnValueOnce([{ data: undefined, fetching: true, error: null }, vi.fn()])
      .mockReturnValueOnce([{ data: undefined, fetching: true, error: null }, vi.fn()])
      .mockReturnValueOnce([{ data: undefined, fetching: true, error: null }, vi.fn()]);

    const { result } = renderHook(() => useTopBarData());
    expect(result.current.version).toBe('...');
    expect(result.current.uptime).toBe('');
    expect(result.current.fetching.gateway).toBe(true);
    expect(result.current.fetching.resources).toBe(true);
  });

  it('returns version from appVersion field', () => {
    mockUseReactiveQuery
      .mockReturnValueOnce([
        {
          data: { gateway: { version: '1.0.0', appVersion: '0.1.0', latestVersion: null, startedAt: null } },
          fetching: false,
          error: null,
        },
        vi.fn(),
      ])
      .mockReturnValueOnce([{ data: { resources: null }, fetching: false, error: null }, vi.fn()])
      .mockReturnValueOnce([{ data: { channels: [] }, fetching: false, error: null }, vi.fn()]);

    const { result } = renderHook(() => useTopBarData());
    expect(result.current.version).toBe('0.1.0');
  });
});
