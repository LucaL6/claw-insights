import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// Polyfill localStorage for happy-dom
if (typeof globalThis.localStorage === 'undefined' || typeof globalThis.localStorage.getItem !== 'function') {
  const store: Record<string, string> = {};
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k in store) delete store[k]; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
}

// Mock heavy child components and hooks
const mockRoute: { route: { page: 'dashboard' | 'logs'; params: Record<string, string> }; navigate: ReturnType<typeof vi.fn> } = { route: { page: 'dashboard', params: {} }, navigate: vi.fn() };
vi.mock('../hooks/useHashRoute', () => ({
  useHashRoute: () => mockRoute,
}));
vi.mock('../hooks/useTopBarData', () => ({
  useTopBarData: () => ({ version: '1.0.0', gateway: { latestVersion: '1.0.1' } }),
}));
vi.mock('../components/topbar/TopBar', () => ({
  TopBar: (props: any) => <div data-testid="topbar">{props.currentPage}</div>,
}));
vi.mock('../components/sessions/SessionPanel', () => ({
  SessionPanel: ({ onReady }: any) => { onReady?.(); return <div data-testid="sessions" />; },
}));
vi.mock('../components/charts/metrics/MetricsSection', () => ({
  MetricsSection: ({ onReady }: any) => { onReady?.(); return <div data-testid="metrics" />; },
}));
let mockModal: string | null = null;
const mockOpen = vi.fn((m: string) => { mockModal = m; });
const mockClose = vi.fn(() => { mockModal = null; });
vi.mock('../components/modals/OperationModals', () => ({
  useOperationModals: () => ({ modal: mockModal, open: mockOpen, close: mockClose }),
  RestartModal: ({ onClose }: any) => <div data-testid="restart-modal"><button onClick={onClose}>close</button></div>,
  UpdateModal: ({ onClose }: any) => <div data-testid="update-modal"><button onClick={onClose}>close</button></div>,
  DoctorModal: ({ onClose }: any) => <div data-testid="doctor-modal"><button onClick={onClose}>close</button></div>,
}));

vi.mock('../components/logs/LogPage', () => ({
  LogPage: () => <div data-testid="log-page" />,
}));

import App from '../App';

describe('App', () => {
  it('renders without crash', () => {
    const { container } = render(<App />);
    expect(container.firstChild).toBeTruthy();
  });

  it('renders TopBar and main content sections', () => {
    render(<App />);
    expect(screen.getAllByTestId('topbar').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('sessions').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('metrics').length).toBeGreaterThan(0);
  });

  it('renders LogPage when route is logs', () => {
    mockRoute.route = { page: 'logs' as const, params: {} };
    render(<App />);
    expect(screen.getByTestId('log-page')).toBeTruthy();
    mockRoute.route = { page: 'dashboard' as const, params: {} };
  });

  it('renders dashboard with valid range param', () => {
    mockRoute.route = { page: 'dashboard' as const, params: { range: 'ONE_HOUR' } };
    render(<App />);
    expect(screen.getAllByTestId('metrics').length).toBeGreaterThan(0);
    mockRoute.route = { page: 'dashboard' as const, params: {} };
  });

  it('renders restart modal when modal is restart', () => {
    mockModal = 'restart';
    render(<App />);
    expect(screen.getByTestId('restart-modal')).toBeTruthy();
    mockModal = null;
  });

  it('renders update modal when modal is update', () => {
    mockModal = 'update';
    render(<App />);
    expect(screen.getByTestId('update-modal')).toBeTruthy();
    mockModal = null;
  });

  it('renders doctor modal when modal is doctor', () => {
    mockModal = 'doctor';
    render(<App />);
    expect(screen.getByTestId('doctor-modal')).toBeTruthy();
    mockModal = null;
  });
});
