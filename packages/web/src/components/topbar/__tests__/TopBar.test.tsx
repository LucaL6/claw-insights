import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render';

const mockTopBarData = {
  gateway: { running: true },
  resources: { cpu: 10 },
  channels: [{ provider: 'discord', name: 'Discord', connected: true }],
  uptime: '2h 30m',
  version: '1.2.3',
  updateLabel: null,
  fetching: { gateway: false, resources: false, channels: false },
};

vi.mock('../../../hooks/useTopBarData', () => ({
  useTopBarData: () => mockTopBarData,
}));

import { TopBar } from '../TopBar';

describe('TopBar', () => {
  afterEach(cleanup);

  it('renders brand name and version', () => {
    renderWithProviders(<TopBar />);
    expect(screen.getByText('v1.2.3')).toBeDefined();
  });

  it('renders with all optional props', () => {
    renderWithProviders(
      <TopBar
        currentPage="dashboard"
        onNavigate={vi.fn()}
        onAction={vi.fn()}
        metricsRange={{ range: 'ONE_HOUR', bucket: 300 } as any}
      />,
    );
    expect(screen.getByText('v1.2.3')).toBeDefined();
  });

  it('shows skeleton when fetching', () => {
    mockTopBarData.fetching.gateway = true;
    renderWithProviders(<TopBar />);
    // Should show skeleton instead of version
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
    mockTopBarData.fetching.gateway = false;
  });
});
