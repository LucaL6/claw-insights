import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render';

// Ensure localStorage works
if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  const store: Record<string, string> = {};
  (globalThis as unknown as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

vi.mock('../../../hooks/useLogPageData', () => ({
  useLogPageData: vi.fn(),
}));

import { useLogPageData } from '../../../hooks/useLogPageData';
import { LogPage } from '../LogPage';
import type { Route } from '../../../hooks/useHashRoute';

afterEach(cleanup);

const mockedHook = vi.mocked(useLogPageData);

const baseMock: ReturnType<typeof useLogPageData> = {
  activeTypes: ['error', 'warning', 'gateway_restart'],
  toggleType: vi.fn(),
  search: '',
  setSearch: vi.fn(),
  filteredEvents: [
    { timestamp: '2026-01-15T10:00:00Z', type: 'error', module: 'gw', message: 'boom' },
  ],
  density: Array.from({ length: 24 }, (_, i) => ({
    hour: i, count: 0, hasError: false, hasWarning: false, hasRestart: false, epochStart: 1700000000 + i * 3600,
  })),
  events: { counts: { error: 1, warning: 0, restart: 0 }, total: 1, events: [] },
  timeLabel: undefined,
  urlFrom: undefined,
  urlTo: undefined,
  eventsLoading: false,
  densityLoading: false,
  eventsError: undefined,
};

const route: Route = { page: 'logs' as const, params: {} };

describe('LogPage', () => {
  beforeEach(() => {
    mockedHook.mockReturnValue(baseMock);
  });

  it('renders title, density strip, filter bar, and event table', () => {
    renderWithProviders(<LogPage route={route} navigate={vi.fn()} />);
    expect(screen.getByRole('heading')).toBeTruthy();
    expect(screen.getByText('error')).toBeTruthy();
    expect(screen.getByText('boom')).toBeTruthy();
    expect(screen.getByText('now')).toBeTruthy();
  });

  it('shows loading states', () => {
    mockedHook.mockReturnValue({ ...baseMock, eventsLoading: true, densityLoading: true, filteredEvents: [] });
    renderWithProviders(<LogPage route={route} navigate={vi.fn()} />);
    expect(screen.getByText('Loading events...')).toBeTruthy();
  });

  it('renders with error state', () => {
    mockedHook.mockReturnValue({
      ...baseMock,
      eventsError: { message: 'Network error', name: 'Error' },
      filteredEvents: [],
    });
    renderWithProviders(<LogPage route={route} navigate={vi.fn()} />);
    expect(screen.getByRole('heading')).toBeTruthy();
  });

  it('renders with empty events', () => {
    mockedHook.mockReturnValue({
      ...baseMock,
      filteredEvents: [],
      events: { counts: { error: 0, warning: 0, restart: 0 }, total: 0, events: [] },
    });
    renderWithProviders(<LogPage route={route} navigate={vi.fn()} />);
    expect(screen.getByRole('heading')).toBeTruthy();
  });

  it('renders with time filter active (urlFrom/urlTo)', () => {
    mockedHook.mockReturnValue({
      ...baseMock,
      urlFrom: 1700000000,
      urlTo: 1700003600,
      timeLabel: '12:00 - 13:00',
    });
    renderWithProviders(<LogPage route={route} navigate={vi.fn()} />);
    expect(screen.getByText('12:00 - 13:00')).toBeTruthy();
  });

  it('renders with different active filter types', () => {
    mockedHook.mockReturnValue({
      ...baseMock,
      activeTypes: ['error'],
    });
    renderWithProviders(<LogPage route={route} navigate={vi.fn()} />);
    expect(screen.getByRole('heading')).toBeTruthy();
  });
});
