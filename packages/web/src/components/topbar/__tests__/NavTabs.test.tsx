import { cleanup,fireEvent, screen } from '@testing-library/react';
import { afterEach,describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { NavTabs } from '../NavTabs';

afterEach(cleanup);

describe('NavTabs', () => {
  it('renders dashboard and logs tabs', () => {
    renderWithProviders(<NavTabs />);
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Logs')).toBeDefined();
  });

  it('highlights current page with boxShadow', () => {
    renderWithProviders(<NavTabs currentPage="dashboard" />);
    const btn = screen.getByText('Dashboard');
    expect(btn.style.boxShadow).toContain('rgba');
  });

  it('calls onNavigate with hash on click', () => {
    const onNavigate = vi.fn();
    renderWithProviders(<NavTabs onNavigate={onNavigate} />);
    fireEvent.click(screen.getByText('Logs'));
    expect(onNavigate).toHaveBeenCalledWith('#logs');
    fireEvent.click(screen.getByText('Dashboard'));
    expect(onNavigate).toHaveBeenCalledWith('#dashboard');
  });
});
