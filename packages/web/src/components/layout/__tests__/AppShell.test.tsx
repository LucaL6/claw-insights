import { cleanup, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';

vi.mock('../../../hooks/useTopBarData', () => ({
  useTopBarData: () => ({ version: '1.0.0', fetching: { gateway: false } }),
}));

vi.mock('../../../hooks/useSnapshot', () => ({
  useSnapshot: () => ({ snapshotting: false, takeSnapshot: vi.fn() }),
}));

import { useIsBelowMd } from '../../../hooks/useIsBelowMd';
import { Sidebar } from '../Sidebar';

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

/** Mirrors the shell branching logic from App.tsx AppInner */
function AppShell({ page }: { page: 'dashboard' | 'logs' }) {
  const isMobile = useIsBelowMd();
  const content = <div data-testid="main-content">Content: {page}</div>;

  if (!isMobile) {
    return (
      <div data-testid="desktop-shell" className="flex h-screen">
        <Sidebar currentPage={page} onNavigate={() => {}} />
        <div className="flex-1">{content}</div>
      </div>
    );
  }

  return <div data-testid="mobile-shell">{content}</div>;
}

describe('App Shell (desktop/mobile integration)', () => {
  afterEach(() => {
    cleanup();
    localStorage.removeItem('ci:sidebar-collapsed');
    mockViewport(1024);
  });

  it('desktop: renders Sidebar + content in flex layout', () => {
    mockViewport(1024);
    renderWithProviders(<AppShell page="dashboard" />);
    expect(screen.getByTestId('desktop-shell')).toBeDefined();
    expect(screen.queryByTestId('mobile-shell')).toBeNull();
    expect(screen.getByRole('navigation')).toBeDefined();
    // Clock renders HH:mm in header
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeDefined();
    expect(screen.getByTestId('main-content')).toBeDefined();
  });

  it('mobile: renders content without Sidebar', () => {
    mockViewport(600);
    renderWithProviders(<AppShell page="dashboard" />);
    expect(screen.getByTestId('mobile-shell')).toBeDefined();
    expect(screen.queryByTestId('desktop-shell')).toBeNull();
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('desktop: Sidebar highlights current page', () => {
    mockViewport(1024);
    renderWithProviders(<AppShell page="logs" />);
    const logsLink = screen.getByRole('link', { name: /logs/i });
    expect(logsLink.getAttribute('aria-current')).toBe('page');
    const dashLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashLink.getAttribute('aria-current')).toBeNull();
  });

  it('desktop: Sidebar shows clock and brand/version in footer', () => {
    mockViewport(1024);
    renderWithProviders(<AppShell page="dashboard" />);
    expect(screen.getByText(/\d{2}:\d{2}/)).toBeDefined();

    const footer = screen.getByTestId('sidebar-brand-footer');
    expect(within(footer).getByText('Claw Insights')).toBeDefined();
    expect(within(footer).getByText(/v1\.0\.0/)).toBeDefined();
  });
});
