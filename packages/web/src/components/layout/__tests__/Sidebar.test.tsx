import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';

vi.mock('../../../hooks/useTopBarData', () => ({
  useTopBarData: () => ({ version: '1.2.3', fetching: { gateway: false } }),
}));

import { Sidebar } from '../Sidebar';

describe('Sidebar', () => {
  beforeEach(() => {
    localStorage.removeItem('ci:sidebar-collapsed');
  });

  afterEach(() => {
    cleanup();
    localStorage.removeItem('ci:sidebar-collapsed');
  });

  it('renders brand name when expanded', () => {
    renderWithProviders(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />);
    expect(screen.getByText('Claw Insights')).toBeDefined();
  });

  it('renders navigation items', () => {
    renderWithProviders(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />);
    expect(screen.getByText('Dashboard')).toBeDefined();
    expect(screen.getByText('Logs')).toBeDefined();
  });

  it('highlights current page', () => {
    renderWithProviders(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />);
    const dashBtn = screen.getByRole('link', { name: /dashboard/i });
    const logsBtn = screen.getByRole('link', { name: /logs/i });
    expect(dashBtn.getAttribute('aria-current')).toBe('page');
    expect(logsBtn.getAttribute('aria-current')).toBeNull();
  });

  it('calls onNavigate when clicking a nav item', () => {
    const onNavigate = vi.fn();
    renderWithProviders(<Sidebar currentPage="dashboard" onNavigate={onNavigate} />);
    fireEvent.click(screen.getByRole('link', { name: /logs/i }));
    expect(onNavigate).toHaveBeenCalledWith('#logs');
  });

  it('renders version in footer when expanded', () => {
    renderWithProviders(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />);
    expect(screen.getByText(/v1\.2\.3/)).toBeDefined();
  });

  it('collapses when toggle button is clicked', () => {
    renderWithProviders(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /collapse/i });
    fireEvent.click(toggle);
    expect(screen.queryByText('Claw Insights')).toBeNull();
    expect(screen.queryByText(/v1\.2\.3/)).toBeNull();
    expect(screen.queryByText('Dashboard')).toBeNull();
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeDefined();
  });

  it('expands when toggle button is clicked in collapsed state', () => {
    renderWithProviders(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /collapse/i });
    fireEvent.click(toggle);
    const expandToggle = screen.getByRole('button', { name: /expand/i });
    fireEvent.click(expandToggle);
    expect(screen.getByText('Claw Insights')).toBeDefined();
  });

  it('has accessible nav landmark', () => {
    renderWithProviders(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />);
    expect(screen.getByRole('navigation')).toBeDefined();
  });

  it('persists collapsed state to localStorage', () => {
    renderWithProviders(<Sidebar currentPage="dashboard" onNavigate={vi.fn()} />);
    const toggle = screen.getByRole('button', { name: /collapse/i });
    fireEvent.click(toggle);
    expect(localStorage.getItem('ci:sidebar-collapsed')).toBe('true');
  });
});
