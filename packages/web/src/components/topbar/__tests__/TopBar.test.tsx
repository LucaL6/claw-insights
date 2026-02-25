// packages/web/src/components/topbar/__tests__/TopBar.test.tsx
import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';

const mockTopBarData = {
  version: '1.2.3',
  fetching: { gateway: false },
};

vi.mock('../../../hooks/useTopBarData', () => ({
  useTopBarData: () => mockTopBarData,
}));

vi.mock('../../../hooks/useSnapshot', () => ({
  useSnapshot: () => ({ snapshotting: false, takeSnapshot: vi.fn() }),
}));

import { TopBar } from '../TopBar';

describe('TopBar', () => {
  afterEach(cleanup);

  it('renders brand name and version', () => {
    renderWithProviders(<TopBar />);
    expect(screen.getByText('v1.2.3')).toBeDefined();
  });

  it('does NOT render gateway status, channels, or resources', () => {
    renderWithProviders(<TopBar />);
    expect(screen.queryByText('UP')).toBeNull();
    expect(screen.queryByText('CPU')).toBeNull();
    expect(screen.queryByText(/restart/i)).toBeNull();
  });

  it('renders nav tabs', () => {
    renderWithProviders(<TopBar currentPage="dashboard" onNavigate={vi.fn()} />);
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Logs')).toBeDefined();
  });

  it('renders snapshot button', () => {
    renderWithProviders(<TopBar />);
    expect(screen.getByTitle(/snapshot/i)).toBeDefined();
  });

  it('shows skeleton when fetching version', () => {
    mockTopBarData.fetching.gateway = true;
    renderWithProviders(<TopBar />);
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
    mockTopBarData.fetching.gateway = false;
  });
});
