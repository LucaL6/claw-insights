import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import type { GatewayStatus } from '../../../hooks/useGatewayData';

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
    mockGatewayData.status = 'down';
    mockGatewayData.resources = null;
    mockGatewayData.channels = [{ provider: 'telegram', name: 'Telegram', connected: false, latencyMs: null }];
    mockGatewayData.uptime = undefined;

    renderWithProviders(<GatewayBanner />);
    expect(screen.getByText('DOWN')).toBeDefined();
    const restartBtn = screen.getByRole('button', { name: /restart/i });
    expect(restartBtn.className).toMatch(/red/);
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('renders connecting state with skeletons and disabled buttons', () => {
    mockGatewayData.status = 'connecting';
    mockGatewayData.fetching = { gateway: true, resources: true, channels: true };
    mockGatewayData.gateway = undefined;

    renderWithProviders(<GatewayBanner />);
    expect(screen.getByText('CONNECTING')).toBeDefined();
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
    const restartBtn = screen.getByRole('button', { name: /restart/i });
    expect(restartBtn).toHaveProperty('disabled', true);
  });

  it('calls onAction with correct payload on restart click', () => {
    const onAction = vi.fn();
    renderWithProviders(<GatewayBanner onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /restart/i }));
    expect(onAction).toHaveBeenCalledWith('restart');
  });

  it('calls onAction with correct payload on doctor click', () => {
    const onAction = vi.fn();
    renderWithProviders(<GatewayBanner onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /doctor/i }));
    expect(onAction).toHaveBeenCalledWith('doctor');
  });

  it('does not call onAction when buttons are disabled (connecting)', () => {
    mockGatewayData.status = 'connecting';
    mockGatewayData.fetching = { gateway: true, resources: true, channels: true };
    const onAction = vi.fn();
    renderWithProviders(<GatewayBanner onAction={onAction} />);
    fireEvent.click(screen.getByRole('button', { name: /restart/i }));
    expect(onAction).not.toHaveBeenCalled();
  });

  it('renders empty channels without breaking', () => {
    mockGatewayData.channels = [];
    renderWithProviders(<GatewayBanner />);
    expect(screen.getByText('OpenClaw Gateway')).toBeDefined();
    expect(screen.queryByText('TG')).toBeNull();
  });

  it('renders DoctorIcon SVG instead of emoji', () => {
    renderWithProviders(<GatewayBanner />);
    const doctorBtn = screen.getByRole('button', { name: /doctor/i });
    const svg = doctorBtn.querySelector('svg');
    expect(svg).toBeTruthy();
  });

  it('restart button uses btn-restart class in running state', () => {
    renderWithProviders(<GatewayBanner />);
    const restartBtn = screen.getByRole('button', { name: /restart/i });
    expect(restartBtn.className).toContain('btn-restart');
  });

  it('doctor button uses btn-doctor class', () => {
    renderWithProviders(<GatewayBanner />);
    const doctorBtn = screen.getByRole('button', { name: /doctor/i });
    expect(doctorBtn.className).toContain('btn-doctor');
  });

  it('renders tooltips for both action buttons', () => {
    const { container } = renderWithProviders(<GatewayBanner />);
    const tooltips = container.querySelectorAll('[role="tooltip"]');
    expect(tooltips.length).toBeGreaterThanOrEqual(2);
  });

  it('tooltip text references OpenClaw Gateway', () => {
    const { container } = renderWithProviders(<GatewayBanner />);
    const tooltips = container.querySelectorAll('[role="tooltip"]');
    const texts = Array.from(tooltips).map((t) => t.textContent);
    expect(texts.some((t) => t?.includes('OpenClaw Gateway'))).toBe(true);
  });
});
