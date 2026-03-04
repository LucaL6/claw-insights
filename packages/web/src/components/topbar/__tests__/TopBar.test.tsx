import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GatewayStatus } from '../../../hooks/useGatewayData';
import { renderWithProviders } from '../../../test/render';

vi.mock('../../../hooks/useSnapshot', () => ({
  useSnapshot: () => ({ snapshotting: false, takeSnapshot: vi.fn() }),
}));

interface MockGwData {
  status: GatewayStatus;
  gateway: { running: boolean; startedAt?: string; appVersion?: string } | undefined;
  resources: { cpu: number; memoryMB: number } | null;
  channels: Array<{ provider: string; name: string; connected: boolean; latencyMs: number | null }>;
  uptime: string | undefined;
  fetching: { gateway: boolean; resources: boolean; channels: boolean };
}

const mockGw: MockGwData = {
  status: 'running',
  gateway: { running: true, startedAt: new Date(Date.now() - 3600_000).toISOString(), appVersion: '1.2.3' },
  resources: { cpu: 3.2, memoryMB: 142 },
  channels: [
    { provider: 'telegram', name: 'Telegram', connected: true, latencyMs: 12 },
    { provider: 'discord', name: 'Discord', connected: true, latencyMs: null },
  ],
  uptime: '1h 0m',
  fetching: { gateway: false, resources: false, channels: false },
};

function resetGwMock() {
  mockGw.status = 'running';
  mockGw.gateway = { running: true, startedAt: new Date(Date.now() - 3600_000).toISOString(), appVersion: '1.2.3' };
  mockGw.resources = { cpu: 3.2, memoryMB: 142 };
  mockGw.channels = [
    { provider: 'telegram', name: 'Telegram', connected: true, latencyMs: 12 },
    { provider: 'discord', name: 'Discord', connected: true, latencyMs: null },
  ];
  mockGw.uptime = '1h 0m';
  mockGw.fetching = { gateway: false, resources: false, channels: false };
}

vi.mock('../../../hooks/useGatewayData', () => ({
  useGatewayData: () => mockGw,
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
    resetGwMock();
  });

  it('renders gateway status on desktop', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    expect(screen.getByText('OpenClaw Gateway')).toBeDefined();
  });

  it('renders lobster icon for OpenClaw monitor context', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    const lobster = screen.getByAltText('OpenClaw lobster') as HTMLImageElement;
    expect(lobster.getAttribute('src')).toBe('/logo/openclaw-lobster.svg');
    expect(screen.queryByAltText('Claw Insights logo')).toBeNull();
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
    expect(screen.getByRole('button', { name: /snapshot/i })).toBeDefined();
  });

  it('renders channels on desktop', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    expect(screen.getByText('TG')).toBeDefined();
    expect(screen.getByText('Discord')).toBeDefined();
  });

  it('renders resources on desktop', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    expect(screen.getByText('CPU')).toBeDefined();
    expect(screen.getByText('3.2%')).toBeDefined();
    expect(screen.getByText('MEM')).toBeDefined();
    expect(screen.getByText('142 MB')).toBeDefined();
  });

  it('dims channels and resources when gateway is down', () => {
    mockViewport(1024);
    mockGw.status = 'gateway-down';
    mockGw.gateway = { running: false };
    mockGw.resources = null;
    mockGw.channels = [{ provider: 'telegram', name: 'Telegram', connected: false, latencyMs: null }];
    mockGw.uptime = undefined;
    renderWithProviders(<TopBar />);
    expect(screen.getByText('DOWN')).toBeDefined();
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  it('hides channels and resources on mobile', () => {
    mockViewport(600);
    renderWithProviders(<TopBar currentPage="dashboard" onNavigate={vi.fn()} />);
    expect(screen.queryByText('TG')).toBeNull();
    expect(screen.queryByText('CPU')).toBeNull();
  });

  it('hides channels and resources for dashboard-offline', () => {
    mockViewport(1024);
    mockGw.status = 'dashboard-offline';
    mockGw.gateway = undefined;
    mockGw.resources = null;
    mockGw.channels = [];
    mockGw.uptime = undefined;
    renderWithProviders(<TopBar />);
    expect(screen.getByText('OFFLINE')).toBeDefined();
    expect(screen.getByText('Claw Insights')).toBeDefined();
    expect(screen.queryByText('CPU')).toBeNull();
  });

  it('shows dashboard title and hides channels for connecting state', () => {
    mockViewport(1024);
    mockGw.status = 'connecting';
    mockGw.gateway = undefined;
    mockGw.resources = null;
    mockGw.channels = [];
    mockGw.uptime = undefined;
    mockGw.fetching = { gateway: true, resources: true, channels: true };
    renderWithProviders(<TopBar />);
    expect(screen.getByText('CONNECTING')).toBeDefined();
    expect(screen.getByText('Claw Insights')).toBeDefined();
    expect(screen.queryByText('CPU')).toBeNull();
  });

  it('shows reconnecting indicator for dashboard-offline', () => {
    mockViewport(1024);
    mockGw.status = 'dashboard-offline';
    mockGw.gateway = undefined;
    mockGw.resources = null;
    mockGw.channels = [];
    mockGw.uptime = undefined;
    renderWithProviders(<TopBar />);
    expect(screen.getByText('Reconnecting…')).toBeDefined();
  });

  it('shows status tooltip on desktop', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    expect(screen.getByText(/OpenClaw is running/i)).toBeDefined();
  });

  it('shows channel tooltip with full name', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    expect(screen.getByText(/Telegram · Connected/i)).toBeDefined();
  });

  it('shows CPU tooltip', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    expect(screen.getByText(/gateway CPU usage/i)).toBeDefined();
  });

  it('shows MEM tooltip', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    expect(screen.getByText(/gateway memory usage/i)).toBeDefined();
  });

  it('shows uptime tooltip', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    expect(screen.getByText(/uptime since start/i)).toBeDefined();
  });

  it('shows down status tooltip when gateway is down', () => {
    mockViewport(1024);
    mockGw.status = 'gateway-down';
    mockGw.gateway = { running: false };
    mockGw.resources = null;
    mockGw.uptime = undefined;
    renderWithProviders(<TopBar />);
    expect(screen.getByText(/gateway is down/i)).toBeDefined();
  });

  it('shows snapshot tooltip instead of native title', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    const snapshotBtn = screen.getByRole('button', { name: /snapshot/i });
    expect(snapshotBtn.getAttribute('title')).toBeNull();
    // Tooltip text + button text both render "Snapshot"
    expect(screen.getAllByText('Snapshot').length).toBeGreaterThanOrEqual(2);
  });

  it('shows theme toggle tooltip instead of native title', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    const themeBtn = screen.getByRole('button', { name: /switch to light/i });
    expect(themeBtn.getAttribute('title')).toBeNull();
  });

  it('shows lang toggle tooltip instead of native title', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    const langBtn = screen.getByRole('button', { name: /switch to 中文/i });
    expect(langBtn.getAttribute('title')).toBeNull();
  });
});
