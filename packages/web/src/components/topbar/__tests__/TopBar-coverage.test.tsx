import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GatewayStatus } from '../../../hooks/useGatewayData';
import { renderWithProviders } from '../../../test/render';

let mockSnapshotting = false;
const mockTakeSnapshot = vi.fn();

vi.mock('../../../hooks/useSnapshot', () => ({
  useSnapshot: () => ({ snapshotting: mockSnapshotting, takeSnapshot: mockTakeSnapshot }),
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
  mockTakeSnapshot.mockReset();
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
    localStorage.clear();
  });

  it('shows skeleton placeholders when fetching channels', () => {
    mockViewport(1024);
    mockGw.fetching = { gateway: false, resources: false, channels: true };
    const { container } = renderWithProviders(<TopBar />);
    const pulseEls = container.querySelectorAll('.animate-pulse');
    expect(pulseEls.length).toBeGreaterThanOrEqual(2);
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
    expect(screen.getByText('3.2%')).toBeDefined();
  });

  it('shows dashes for CPU/mem when resources is null and status is running', () => {
    mockViewport(1024);
    mockGw.resources = null;
    renderWithProviders(<TopBar />);
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
  });

  // --- snapshot onClick branches (lines 168-169) ---

  it('snapshot onClick passes section=logs when currentPage is logs', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar currentPage="logs" />);
    const btn = screen.getByRole('button', { name: /snapshot/i });
    fireEvent.click(btn);
    expect(mockTakeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'logs', range: 'TWENTY_FOUR_HOUR' }),
    );
  });

  it('snapshot onClick passes section=dashboard when currentPage is dashboard', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar currentPage="dashboard" />);
    const btn = screen.getByRole('button', { name: /snapshot/i });
    fireEvent.click(btn);
    expect(mockTakeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'dashboard', range: 'TWENTY_FOUR_HOUR' }),
    );
  });

  it('snapshot onClick passes section=dashboard when currentPage is undefined', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    const btn = screen.getByRole('button', { name: /snapshot/i });
    fireEvent.click(btn);
    expect(mockTakeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'dashboard', range: 'TWENTY_FOUR_HOUR' }),
    );
  });

  it('snapshot onClick uses custom metricsRange when provided', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar currentPage="dashboard" metricsRange="ONE_HOUR" />);
    const btn = screen.getByRole('button', { name: /snapshot/i });
    fireEvent.click(btn);
    expect(mockTakeSnapshot).toHaveBeenCalledWith(expect.objectContaining({ section: 'dashboard', range: 'ONE_HOUR' }));
  });

  it('snapshot onClick includes theme and lang', () => {
    mockViewport(1024);
    renderWithProviders(<TopBar currentPage="logs" metricsRange="TWELVE_HOUR" />);
    const btn = screen.getByRole('button', { name: /snapshot/i });
    fireEvent.click(btn);
    expect(mockTakeSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({ section: 'logs', range: 'TWELVE_HOUR', theme: 'dark', lang: expect.any(String) }),
    );
  });

  // --- theme light branch (lines 183, 186, 189) ---

  it('theme toggle shows light-mode aria-label and sun icon when theme is light', () => {
    localStorage.setItem('ci:theme', JSON.stringify('light'));
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    const themeBtn = screen.getByRole('button', { name: /switch to dark/i });
    expect(themeBtn).toBeDefined();
  });

  // --- lang zh branch (lines 193, 196, 199) ---

  it('lang toggle shows zh aria-label and 中 text when lang is zh', () => {
    localStorage.setItem('ci:lang', JSON.stringify('zh'));
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    // When lang=zh, the button text should be '中' and aria-label should mention English toggle
    const langBtn = screen.getByRole('button', { name: /切换为英文/i });
    expect(langBtn).toBeDefined();
    expect(langBtn.textContent).toBe('中');
  });

  it('lang toggle shows en aria-label and EN text when lang is en', () => {
    localStorage.setItem('ci:lang', JSON.stringify('en'));
    mockViewport(1024);
    renderWithProviders(<TopBar />);
    const langBtn = screen.getByRole('button', { name: /switch to 中文/i });
    expect(langBtn).toBeDefined();
    expect(langBtn.textContent).toBe('EN');
  });

  it('does not call takeSnapshot when snapshotting is true (button disabled)', () => {
    mockViewport(1024);
    mockSnapshotting = true;
    renderWithProviders(<TopBar currentPage="logs" />);
    const btn = screen.getByRole('button', { name: /snapshot/i });
    fireEvent.click(btn);
    expect(mockTakeSnapshot).not.toHaveBeenCalled();
  });
});
