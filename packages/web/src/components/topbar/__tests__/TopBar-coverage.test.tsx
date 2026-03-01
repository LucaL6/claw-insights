import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GatewayStatus } from '../../../hooks/useGatewayData';
import { renderWithProviders } from '../../../test/render';

let mockSnapshotting = false;

vi.mock('../../../hooks/useSnapshot', () => ({
  useSnapshot: () => ({ snapshotting: mockSnapshotting, takeSnapshot: vi.fn() }),
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
  mockSnapshotting = false;
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

describe('TopBar – coverage delta', () => {
  afterEach(() => {
    cleanup();
    mockViewport(1024);
    resetGwMock();
  });

  it('shows skeleton placeholders when fetching channels', () => {
    mockViewport(1024);
    mockGw.fetching = { gateway: false, resources: false, channels: true };
    const { container } = renderWithProviders(<TopBar />);
    const pulseEls = container.querySelectorAll('.animate-pulse');
    expect(pulseEls.length).toBeGreaterThanOrEqual(2);
    // Channel names should NOT appear during skeleton
    expect(screen.queryByText('TG')).toBeNull();
    expect(screen.queryByText('Discord')).toBeNull();
  });

  it('shows red dot for disconnected channel when running', () => {
    mockViewport(1024);
    mockGw.channels = [{ provider: 'telegram', name: 'Telegram', connected: false, latencyMs: null }];
    const { container } = renderWithProviders(<TopBar />);
    const dots = container.querySelectorAll('.bg-red');
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it('disables snapshot button and shows cursor-wait when snapshotting', () => {
    mockViewport(1024);
    mockSnapshotting = true;
    renderWithProviders(<TopBar />);
    const btn = screen.getByRole('button', { name: /snapshot/i });
    expect(btn.hasAttribute('disabled')).toBe(true);
    expect(btn.className).toContain('cursor-wait');
  });

  it('renders no channel names when channels array is empty and running', () => {
    mockViewport(1024);
    mockGw.channels = [];
    renderWithProviders(<TopBar />);
    expect(screen.queryByText('TG')).toBeNull();
    expect(screen.queryByText('Discord')).toBeNull();
    // Resources should still show
    expect(screen.getByText('3.2%')).toBeDefined();
  });

  it('shows dashes for CPU/mem when resources is null and status is running', () => {
    mockViewport(1024);
    mockGw.resources = null;
    renderWithProviders(<TopBar />);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });
});
