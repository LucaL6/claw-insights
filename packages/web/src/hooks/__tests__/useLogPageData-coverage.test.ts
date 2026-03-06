import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { type Client, Provider } from 'urql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fromValue, never } from 'wonka';

import { I18nProvider } from '../../i18n/context';
import type { Route } from '../useHashRoute';
import { processEvents, useLogPageData } from '../useLogPageData';

const mockNavigate = vi.fn();
vi.mock('../useHashRoute', async () => {
  const actual = await vi.importActual<typeof import('../useHashRoute')>('../useHashRoute');
  return {
    ...actual,
    useHashRoute: () => ({
      route: { page: 'logs' as const, params: {} },
      navigate: mockNavigate,
    }),
  };
});

function createMockClient(data: Record<string, unknown> = {}) {
  return {
    executeQuery: () => fromValue({ data, stale: false, hasNext: false }),
    executeMutation: () => never,
    executeSubscription: () => never,
  } as unknown as Client;
}

function wrapper(client: Client) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(I18nProvider, null, React.createElement(Provider, { value: client }, children));
}

const emptyData = {
  events: { events: [], total: 0, counts: {} },
  eventDensity: [],
  eventCounts: { error: 0, warning: 0, restart: 0 },
};

describe('useLogPageData — delta coverage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
  });

  // 1. toggleType with urlFrom+urlTo preserves from/to params
  it('toggleType includes from/to params when present', () => {
    const route: Route = { page: 'logs', params: { from: '1700000000', to: '1700003600' } };
    const client = createMockClient(emptyData);
    const { result } = renderHook(() => useLogPageData(route), { wrapper: wrapper(client) });

    act(() => {
      result.current.toggleType('warning');
    });
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    const url = mockNavigate.mock.calls[0][0] as string;
    expect(url).toContain('from=1700000000');
    expect(url).toContain('to=1700003600');
    expect(url).toContain('type=');
  });

  // 2. timeLabel: same day today → time-only
  it('timeLabel shows time-only for same-day today range', () => {
    // Use fake timers at a fixed time in the middle of the day to avoid midnight boundary issues
    vi.useFakeTimers();
    const fixedNow = new Date('2026-03-07T12:00:00Z');
    vi.setSystemTime(fixedNow);

    try {
      const now = Math.floor(fixedNow.getTime() / 1000);
      const from = now - 3600; // 11:00
      const to = now - 60; // 11:59
      const route: Route = { page: 'logs', params: { from: String(from), to: String(to) } };
      const client = createMockClient(emptyData);
      const { result } = renderHook(() => useLogPageData(route), { wrapper: wrapper(client) });

      expect(result.current.timeLabel).toBeDefined();
      expect(result.current.timeLabel).toContain('→');
      // Same day today: no month name, just HH:MM → HH:MM
      // Should NOT contain month abbreviation
      expect(result.current.timeLabel).toMatch(/^\d{2}:\d{2} → \d{2}:\d{2}$/);
    } finally {
      vi.useRealTimers();
    }
  });

  // 3. timeLabel: same day not today → date+time
  it('timeLabel shows date+time for same-day not today', () => {
    // Use a date in the past (2025-06-15)
    const from = Math.floor(new Date('2025-06-15T10:00:00Z').getTime() / 1000);
    const to = Math.floor(new Date('2025-06-15T12:00:00Z').getTime() / 1000);
    const route: Route = { page: 'logs', params: { from: String(from), to: String(to) } };
    const client = createMockClient(emptyData);
    const { result } = renderHook(() => useLogPageData(route), { wrapper: wrapper(client) });

    expect(result.current.timeLabel).toBeDefined();
    expect(result.current.timeLabel).toContain('→');
    // Should contain a date portion (month) before the first time, but only one date
    // Format: "Jun 15 HH:MM → HH:MM" or similar locale variant
    // The key: there's a date on the left side but NOT a second date on the right
    const parts = result.current.timeLabel!.split('→').map((s) => s.trim());
    expect(parts).toHaveLength(2);
    // Left has date+time (longer), right is time-only (shorter)
    expect(parts[0].length).toBeGreaterThan(parts[1].length);
  });

  // 4. timeLabel: different days → full date both sides
  it('timeLabel shows full date on both sides for different days', () => {
    const from = Math.floor(new Date('2025-06-10T04:00:00Z').getTime() / 1000);
    const to = Math.floor(new Date('2025-06-12T04:00:00Z').getTime() / 1000);
    const route: Route = { page: 'logs', params: { from: String(from), to: String(to) } };
    const client = createMockClient(emptyData);
    const { result } = renderHook(() => useLogPageData(route), { wrapper: wrapper(client) });

    expect(result.current.timeLabel).toBeDefined();
    const parts = result.current.timeLabel!.split('→').map((s) => s.trim());
    expect(parts).toHaveLength(2);
    // Both sides should have date+time (similar lengths)
    // Both sides contain date+time (same format)
    expect(parts[0]).toMatch(/\d{2}:\d{2}/);
    expect(parts[1]).toMatch(/\d{2}:\d{2}/);
    // Both sides include a date portion (not just time)
    // Each part should be longer than just "HH:MM" (5 chars)
    expect(parts[0].length).toBeGreaterThan(5);
    expect(parts[1].length).toBeGreaterThan(5);
  });

  // 5. Filter by module only
  it('filters events by module: prefix', () => {
    const events = {
      events: [
        { message: 'msg1', module: 'discord', timestamp: '2026-01-01T00:02:00Z', type: 'error' },
        { message: 'msg2', module: 'gateway', timestamp: '2026-01-01T00:01:00Z', type: 'error' },
        { message: 'msg3', module: 'discord', timestamp: '2026-01-01T00:00:00Z', type: 'warning' },
      ],
      total: 3,
      counts: {},
    };
    const client = createMockClient({ ...emptyData, events });
    const { result } = renderHook(() => useLogPageData({ page: 'logs', params: {} }), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.setSearch('module:discord');
    });
    expect(result.current.processedEvents).toHaveLength(2);
    expect(result.current.processedEvents.every((e) => e.module === 'discord')).toBe(true);
  });

  // 6. Filter by regex
  it('filters events by regex pattern', () => {
    const events = {
      events: [
        { message: 'error 404 not found', module: 'gw', timestamp: '2026-01-01T00:02:00Z', type: 'error' },
        { message: 'all good', module: 'gw', timestamp: '2026-01-01T00:01:00Z', type: 'error' },
        { message: 'code 500 fail', module: 'gw', timestamp: '2026-01-01T00:00:00Z', type: 'error' },
      ],
      total: 3,
      counts: {},
    };
    const client = createMockClient({ ...emptyData, events });
    const { result } = renderHook(() => useLogPageData({ page: 'logs', params: {} }), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.setSearch('/\\d{3}/');
    });
    expect(result.current.processedEvents).toHaveLength(2);
    expect(result.current.processedEvents[0].message).toBe('error 404 not found');
    expect(result.current.processedEvents[1].message).toBe('code 500 fail');
  });

  // 7. activeTypes with empty type param → ALL_TYPES
  it('returns ALL_TYPES when type param is empty string', () => {
    const route: Route = { page: 'logs', params: { type: '' } };
    const client = createMockClient(emptyData);
    const { result } = renderHook(() => useLogPageData(route), { wrapper: wrapper(client) });

    expect(result.current.activeTypes).toEqual(['error', 'warning', 'gateway_restart']);
  });

  // 8. processEvents: gap on prev prevents repeat grouping
  it('does not group repeats when prev has gapBefore', () => {
    const events = [
      { timestamp: '2026-01-01T01:00:00Z', type: 'error', module: 'gw', message: 'fail' },
      // 10 min gap from first → second gets gapBefore
      { timestamp: '2026-01-01T00:50:00Z', type: 'error', module: 'gw', message: 'fail' },
      // Same message as prev (which has gapBefore) — should NOT group, should be separate
      { timestamp: '2026-01-01T00:49:30Z', type: 'error', module: 'gw', message: 'fail' },
    ];
    const result = processEvents(events);
    // Event 0: normal, Event 1: gapBefore, Event 2: same msg as event 1 but event 1 has gapBefore → no grouping
    expect(result).toHaveLength(3);
    expect(result[1].gapBefore).toBe(600);
    expect(result[2].repeatCount).toBeUndefined();
  });
});
