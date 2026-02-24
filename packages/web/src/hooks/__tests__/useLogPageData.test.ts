import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import React from 'react';
import { Provider, type Client } from 'urql';
import { fromValue, never } from 'wonka';

import { useLogPageData } from '../useLogPageData';
import type { Route } from '../useHashRoute';

function createMockClient(data: Record<string, unknown> = {}) {
  return {
    executeQuery: () => fromValue({ data, stale: false, hasNext: false }),
    executeMutation: () => never,
    executeSubscription: () => never,
  } as unknown as Client;
}

function wrapper(client: Client) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(Provider, { value: client }, children);
}

describe('useLogPageData', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const baseRoute: Route = { page: 'logs', params: {} };

  it('returns default active types and empty events', () => {
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
    });
    const { result } = renderHook(() => useLogPageData(baseRoute), {
      wrapper: wrapper(client),
    });
    expect(result.current.activeTypes).toEqual(['error', 'warning', 'gateway_restart']);
    expect(result.current.filteredEvents).toEqual([]);
    expect(result.current.timeLabel).toBeUndefined();
  });

  it('parses URL params for types', () => {
    const route: Route = { page: 'logs', params: { type: 'error' } };
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
    });
    const { result } = renderHook(() => useLogPageData(route), {
      wrapper: wrapper(client),
    });
    expect(result.current.activeTypes).toEqual(['error']);
  });

  it('filters events by search', () => {
    const events = {
      events: [
        { message: 'Connection failed', module: 'discord', timestamp: 1, type: 'error' },
        { message: 'All good', module: 'gateway', timestamp: 2, type: 'warning' },
      ],
      total: 2,
      counts: {},
    };
    const client = createMockClient({ events, eventDensity: [] });
    const { result } = renderHook(() => useLogPageData(baseRoute), {
      wrapper: wrapper(client),
    });
    expect(result.current.filteredEvents).toHaveLength(2);

    act(() => {
      result.current.setSearch('discord');
    });
    expect(result.current.filteredEvents).toHaveLength(1);
    expect(result.current.filteredEvents[0].module).toBe('discord');
  });

  it('toggleType removes a type and updates URL', () => {
    const route: Route = { page: 'logs', params: {} };
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
    });
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    const { result } = renderHook(() => useLogPageData(route), {
      wrapper: wrapper(client),
    });
    expect(result.current.activeTypes).toEqual(['error', 'warning', 'gateway_restart']);

    act(() => {
      result.current.toggleType('warning');
    });
    expect(result.current.activeTypes).toEqual(['error', 'gateway_restart']);
    expect(replaceSpy).toHaveBeenCalled();
    const url = replaceSpy.mock.calls[0][2] as string;
    expect(url).toContain('type=error%2Cgateway_restart');
    replaceSpy.mockRestore();
  });

  it('toggleType adds a type back', () => {
    const route: Route = { page: 'logs', params: { type: 'error' } };
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
    });
    const { result } = renderHook(() => useLogPageData(route), {
      wrapper: wrapper(client),
    });
    expect(result.current.activeTypes).toEqual(['error']);

    act(() => {
      result.current.toggleType('warning');
    });
    expect(result.current.activeTypes).toEqual(['error', 'warning']);
  });

  it('toggleType prevents empty selection', () => {
    const route: Route = { page: 'logs', params: { type: 'error' } };
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
    });
    const { result } = renderHook(() => useLogPageData(route), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.toggleType('error');
    });
    // Should keep 'error' since removing it would leave empty
    expect(result.current.activeTypes).toEqual(['error']);
  });

  it('toggleType preserves from/to in URL params', () => {
    const route: Route = { page: 'logs', params: { from: '1700000000', to: '1700003600' } };
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
    });
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    const { result } = renderHook(() => useLogPageData(route), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.toggleType('warning');
    });
    const url = replaceSpy.mock.calls[0][2] as string;
    expect(url).toContain('from=1700000000');
    expect(url).toContain('to=1700003600');
    replaceSpy.mockRestore();
  });

  it('toggleType omits type param when all types selected', () => {
    const route: Route = { page: 'logs', params: { type: 'error,warning' } };
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
    });
    const replaceSpy = vi.spyOn(window.history, 'replaceState');
    const { result } = renderHook(() => useLogPageData(route), {
      wrapper: wrapper(client),
    });

    act(() => {
      result.current.toggleType('gateway_restart');
    });
    // All 3 types now selected — URL should NOT have type param
    const url = replaceSpy.mock.calls[0][2] as string;
    expect(url).toBe('#logs');
    replaceSpy.mockRestore();
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

  it('returns empty filteredEvents when events.events is null', () => {
    const client = createMockClient({ events: null, eventDensity: [] });
    const { result } = renderHook(() => useLogPageData(baseRoute), {
      wrapper: wrapper(client),
    });
    expect(result.current.filteredEvents).toEqual([]);
  });

  it('defaults density to empty array when missing', () => {
    const client = createMockClient({ events: { events: [], total: 0, counts: {} } });
    const { result } = renderHook(() => useLogPageData(baseRoute), {
      wrapper: wrapper(client),
    });
    expect(result.current.density).toEqual([]);
  });

  it('computes timeLabel when from/to provided', () => {
    const route: Route = {
      page: 'logs',
      params: { from: '1700000000', to: '1700003600' },
    };
    const client = createMockClient({
      events: { events: [], total: 0, counts: {} },
      eventDensity: [],
    });
    const { result } = renderHook(() => useLogPageData(route), {
      wrapper: wrapper(client),
    });
    expect(result.current.timeLabel).toBeDefined();
    expect(result.current.timeLabel).toContain('→');
  });
});
