import { act, renderHook } from '@testing-library/react';
import React from 'react';
import { type Client, Provider } from 'urql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fromValue, never } from 'wonka';

import { I18nProvider } from '../../i18n/context';
import type { Route } from '../useHashRoute';
import { parseSearch, processEvents, useLogPageData } from '../useLogPageData';

// Mock useHashRoute to provide navigate
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

// --- parseSearch unit tests ---

describe('parseSearch', () => {
  it('returns empty for empty input', () => {
    expect(parseSearch('')).toEqual({});
    expect(parseSearch('  ')).toEqual({});
  });

  it('extracts module prefix', () => {
    expect(parseSearch('module:discord')).toEqual({ module: 'discord' });
  });

  it('extracts module prefix with remaining text', () => {
    const result = parseSearch('module:discord connection');
    expect(result.module).toBe('discord');
    expect(result.text).toBe('connection');
  });

  it('detects regex pattern', () => {
    const result = parseSearch('/error \\d+/i');
    expect(result.regex).toBeInstanceOf(RegExp);
    expect(result.regex!.flags).toBe('i');
    expect(result.regex!.source).toBe('error \\d+');
  });

  it('returns regexError for invalid regex', () => {
    const result = parseSearch('/[invalid/');
    expect(result.regexError).toBe(true);
  });

  it('returns regexError for regex > 200 chars', () => {
    const result = parseSearch('/' + 'a'.repeat(201) + '/');
    expect(result.regexError).toBe(true);
  });

  it('handles module + regex combo', () => {
    const result = parseSearch('module:gw /restart/g');
    expect(result.module).toBe('gw');
    expect(result.regex).toBeInstanceOf(RegExp);
  });

  it('falls back to plain text', () => {
    const result = parseSearch('connection failed');
    expect(result.text).toBe('connection failed');
  });
});

// --- processEvents unit tests ---

describe('processEvents', () => {
  it('returns empty for empty input', () => {
    expect(processEvents([])).toEqual([]);
  });

  it('passes through single event', () => {
    const events = [{ timestamp: '2026-01-01T00:00:00Z', type: 'error', module: 'gw', message: 'fail' }];
    const result = processEvents(events);
    expect(result).toHaveLength(1);
    expect(result[0].message).toBe('fail');
  });

  it('groups consecutive repeats', () => {
    const events = [
      { timestamp: '2026-01-01T00:03:00Z', type: 'error', module: 'gw', message: 'fail' },
      { timestamp: '2026-01-01T00:02:00Z', type: 'error', module: 'gw', message: 'fail' },
      { timestamp: '2026-01-01T00:01:00Z', type: 'error', module: 'gw', message: 'fail' },
    ];
    const result = processEvents(events);
    expect(result).toHaveLength(1);
    expect(result[0].repeatCount).toBe(3);
    expect(result[0].repeatFirst).toBe('2026-01-01T00:01:00Z');
  });

  it('detects gaps >= 300s', () => {
    const events = [
      { timestamp: '2026-01-01T01:00:00Z', type: 'error', module: 'gw', message: 'a' },
      { timestamp: '2026-01-01T00:50:00Z', type: 'error', module: 'gw', message: 'b' },
    ];
    const result = processEvents(events);
    expect(result).toHaveLength(2);
    expect(result[1].gapBefore).toBe(600);
  });

  it('does not detect gap < 300s', () => {
    const events = [
      { timestamp: '2026-01-01T00:04:00Z', type: 'error', module: 'gw', message: 'a' },
      { timestamp: '2026-01-01T00:01:00Z', type: 'error', module: 'gw', message: 'b' },
    ];
    const result = processEvents(events);
    expect(result).toHaveLength(2);
    expect(result[1].gapBefore).toBeUndefined();
  });

  it('breaks repeat chain across gap', () => {
    const events = [
      { timestamp: '2026-01-01T01:00:00Z', type: 'error', module: 'gw', message: 'fail' },
      { timestamp: '2026-01-01T00:50:00Z', type: 'error', module: 'gw', message: 'fail' },
    ];
    const result = processEvents(events);
    expect(result).toHaveLength(2);
    expect(result[0].repeatCount).toBeUndefined();
    expect(result[1].gapBefore).toBe(600);
  });
});

// --- Hook integration tests ---

describe('useLogPageData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockNavigate.mockClear();
  });

  const baseRoute: Route = { page: 'logs', params: {} };

  it('returns default active types and empty processedEvents', () => {
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
      eventCounts: { error: 0, warning: 0, restart: 0 },
    });
    const { result } = renderHook(() => useLogPageData(baseRoute), {
      wrapper: wrapper(client),
    });
    expect(result.current.activeTypes).toEqual(['error', 'warning', 'gateway_restart']);
    expect(result.current.processedEvents).toEqual([]);
    expect(result.current.timeLabel).toBeUndefined();
  });

  it('derives activeTypes from route params', () => {
    const route: Route = { page: 'logs', params: { type: 'error' } };
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
      eventCounts: { error: 5, warning: 0, restart: 0 },
    });
    const { result } = renderHook(() => useLogPageData(route), {
      wrapper: wrapper(client),
    });
    expect(result.current.activeTypes).toEqual(['error']);
  });

  it('returns counts from independent query', () => {
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
      eventCounts: { error: 10, warning: 3, restart: 1 },
    });
    const { result } = renderHook(() => useLogPageData(baseRoute), {
      wrapper: wrapper(client),
    });
    expect(result.current.counts).toEqual({ error: 10, warning: 3, restart: 1 });
  });

  it('defaults counts when query has no data', () => {
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
    });
    const { result } = renderHook(() => useLogPageData(baseRoute), {
      wrapper: wrapper(client),
    });
    expect(result.current.counts).toEqual({ error: 0, warning: 0, restart: 0 });
  });

  it('filters events by search text', () => {
    const events = {
      events: [
        { message: 'Connection failed', module: 'discord', timestamp: '2026-01-01T00:01:00Z', type: 'error' },
        { message: 'All good', module: 'gateway', timestamp: '2026-01-01T00:00:30Z', type: 'warning' },
      ],
      total: 2,
      counts: {},
    };
    const client = createMockClient({ events, eventDensity: [], eventCounts: { error: 1, warning: 1, restart: 0 } });
    const { result } = renderHook(() => useLogPageData(baseRoute), {
      wrapper: wrapper(client),
    });
    expect(result.current.processedEvents).toHaveLength(2);

    act(() => {
      result.current.setSearch('discord');
    });
    expect(result.current.processedEvents).toHaveLength(1);
    expect(result.current.processedEvents[0].module).toBe('discord');
  });

  it('sets searchError for invalid regex', () => {
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
      eventCounts: { error: 0, warning: 0, restart: 0 },
    });
    const { result } = renderHook(() => useLogPageData(baseRoute), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.setSearch('/[bad/');
    });
    expect(result.current.searchError).toBe(true);
  });

  it('toggleType calls navigate', () => {
    const route: Route = { page: 'logs', params: {} };
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
      eventCounts: { error: 0, warning: 0, restart: 0 },
    });
    const { result } = renderHook(() => useLogPageData(route), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.toggleType('warning');
    });
    expect(mockNavigate).toHaveBeenCalledWith(expect.stringContaining('#logs'));
  });

  it('toggleType prevents empty selection', () => {
    const route: Route = { page: 'logs', params: { type: 'error' } };
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
      eventCounts: { error: 0, warning: 0, restart: 0 },
    });
    const { result } = renderHook(() => useLogPageData(route), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.toggleType('error');
    });
    // Should not navigate since it would result in empty
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('computes timeLabel when from/to provided', () => {
    const route: Route = {
      page: 'logs',
      params: { from: '1700000000', to: '1700003600' },
    };
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
      eventCounts: { error: 0, warning: 0, restart: 0 },
    });
    const { result } = renderHook(() => useLogPageData(route), {
      wrapper: wrapper(client),
    });
    expect(result.current.timeLabel).toBeDefined();
    expect(result.current.timeLabel).toContain('→');
  });

  it('reports eventsError from query', () => {
    const client = {
      executeQuery: () => fromValue({ data: null, error: { message: 'Network error' }, stale: false, hasNext: false }),
      executeMutation: () => never,
      executeSubscription: () => never,
    } as unknown as Client;
    const { result } = renderHook(() => useLogPageData(baseRoute), {
      wrapper: wrapper(client),
    });
    expect(result.current.eventsError).toBe('Network error');
  });
});
