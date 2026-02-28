import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';

vi.mock('../../../hooks/useSnapshot', () => ({
  useSnapshot: () => ({ snapshotting: false, takeSnapshot: vi.fn() }),
}));

vi.mock('../../../hooks/useGatewayData', () => ({
  useGatewayData: () => ({
    status: 'running',
    gateway: { running: true, startedAt: new Date(Date.now() - 3600_000).toISOString() },
    resources: null,
    channels: [],
    uptime: '1h',
    fetching: { gateway: false, resources: false, channels: false },
  }),
}));

import { TopBar } from '../TopBar';

function mockViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: width });
  window.matchMedia = (query: string) =>
    ({
      matches: width < 768,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

describe('TopBar', () => {
  afterEach(() => {
    cleanup();
    mockViewport(1024);
  });

  it('renders gateway status on desktop', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    expect(screen.getByText('OpenClaw Gateway')).toBeDefined();
  });

  it('renders nav tabs in mobile mode (no gateway)', () => {
    mockViewport(600);
    renderWithProviders(<TopBar currentPage="dashboard" onNavigate={vi.fn()} />);
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Logs')).toBeDefined();
    expect(screen.queryByText('OpenClaw Gateway')).toBeNull();
  });

  it('hides nav tabs on desktop', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar currentPage="dashboard" onNavigate={vi.fn()} />);
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.queryByText('Logs')).toBeNull();
  });

  it('renders snapshot button', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    expect(screen.getByTitle(/snapshot/i)).toBeDefined();
  });
});
