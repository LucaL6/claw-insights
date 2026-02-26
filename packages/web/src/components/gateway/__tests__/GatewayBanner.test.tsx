import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GatewayStatus } from '../../../hooks/useGatewayData';
import { renderWithProviders } from '../../../test/render';

interface MockData {
  gateway: { running: boolean } | undefined;
  resources: { cpu: number; memoryMB: number } | null;
  channels: Array<{ provider: string; name: string; connected: boolean; latencyMs: number | null }>;
  uptime: string | undefined;
  status: GatewayStatus;
  fetching: { gateway: boolean; resources: boolean; channels: boolean };
}

const mockGatewayData: MockData = {
  gateway: { running: true },
  resources: { cpu: 2.1, memoryMB: 85 },
  channels: [
    { provider: 'telegram', name: 'Telegram', connected: true, latencyMs: 12 },
    { provider: 'whatsapp', name: 'WhatsApp', connected: true, latencyMs: 45 },
  ],
  uptime: '3d 2h',
  status: 'running',
  fetching: { gateway: false, resources: false, channels: false },
};

vi.mock('../../../hooks/useGatewayData', () => ({
  useGatewayData: () => mockGatewayData,
}));

import { GatewayBanner } from '../GatewayBanner';

function resetMock() {
  mockGatewayData.gateway = { running: true };
  mockGatewayData.resources = { cpu: 2.1, memoryMB: 85 };
  mockGatewayData.channels = [
    { provider: 'telegram', name: 'Telegram', connected: true, latencyMs: 12 },
    { provider: 'whatsapp', name: 'WhatsApp', connected: true, latencyMs: 45 },
  ];
  mockGatewayData.uptime = '3d 2h';
  mockGatewayData.status = 'running';
  mockGatewayData.fetching = { gateway: false, resources: false, channels: false };
}

describe('GatewayBanner', () => {
  afterEach(() => {
    cleanup();
    resetMock();
  });

  it('renders running state with gateway title, channels and resources', () => {
    renderWithProviders(<GatewayBanner />);
    expect(screen.getByText('OpenClaw Gateway')).toBeDefined();
    expect(screen.getByText('UP')).toBeDefined();
    expect(screen.getByText('TG')).toBeDefined();
    expect(screen.getByText('WA')).toBeDefined();
    expect(screen.getByText('2.1%')).toBeDefined();
    expect(screen.getByText('85M')).toBeDefined();
  });

  it('renders down state with red styling and greyed channels', () => {
    mockGatewayData.gateway = { running: false };
    mockGatewayData.status = 'gateway-down';
    mockGatewayData.resources = null;
    mockGatewayData.channels = [{ provider: 'telegram', name: 'Telegram', connected: false, latencyMs: null }];
    mockGatewayData.uptime = undefined;

    renderWithProviders(<GatewayBanner />);
    expect(screen.getByText('DOWN')).toBeDefined();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('renders connecting state with Claw Insights title, no channels/resources', () => {
    mockGatewayData.status = 'connecting';
    mockGatewayData.fetching = { gateway: true, resources: true, channels: true };
    mockGatewayData.gateway = undefined;

    renderWithProviders(<GatewayBanner />);
    expect(screen.getByText('Claw Insights')).toBeDefined();
    expect(screen.getByText('CONNECTING')).toBeDefined();
    // isDashboardIssue = true → no channels, no resources
    expect(screen.queryByText('CPU')).toBeNull();
  });

  it('renders empty channels without breaking', () => {
    mockGatewayData.channels = [];
    renderWithProviders(<GatewayBanner />);
    expect(screen.getByText('OpenClaw Gateway')).toBeDefined();
    expect(screen.queryByText('TG')).toBeNull();
  });

  it('renders dashboard-offline with Claw Insights title and amber styling', () => {
    mockGatewayData.status = 'dashboard-offline';
    mockGatewayData.gateway = undefined;
    mockGatewayData.resources = null;
    mockGatewayData.channels = [];
    mockGatewayData.uptime = undefined;
    mockGatewayData.fetching = { gateway: false, resources: false, channels: false };

    renderWithProviders(<GatewayBanner />);
    expect(screen.getByText('Claw Insights')).toBeDefined();
    expect(screen.getByText('OFFLINE')).toBeDefined();
    expect(screen.getByText('Reconnecting…')).toBeDefined();
    expect(screen.queryByText('TG')).toBeNull();
    expect(screen.queryByText('CPU')).toBeNull();
  });

  it('renders gateway-down with OpenClaw Gateway title', () => {
    mockGatewayData.status = 'gateway-down';
    mockGatewayData.gateway = { running: false };
    mockGatewayData.resources = null;
    mockGatewayData.channels = [];
    mockGatewayData.uptime = undefined;

    renderWithProviders(<GatewayBanner />);
    expect(screen.getByText('OpenClaw Gateway')).toBeDefined();
    expect(screen.getByText('DOWN')).toBeDefined();
    expect(screen.getByText('CPU')).toBeDefined();
  });
});
