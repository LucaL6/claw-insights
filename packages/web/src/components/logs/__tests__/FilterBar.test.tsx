import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render';
import { FilterBar } from '../FilterBar';

afterEach(cleanup);

const baseCounts = { error: 3, warning: 2, restart: 1 };

const baseProps = {
  activeTypes: ['error', 'warning', 'gateway_restart'],
  onToggleType: vi.fn(),
  counts: baseCounts,
  total: 100,
  displayed: 50,
  filtered: 6,
  search: '',
  onSearchChange: vi.fn(),
};

describe('FilterBar', () => {
  it('renders pill buttons for each type', () => {
    renderWithProviders(<FilterBar {...baseProps} />);
    expect(screen.getByText('error')).toBeTruthy();
    expect(screen.getByText('warn')).toBeTruthy();
    expect(screen.getByText('restart')).toBeTruthy();
  });

  it('fires onToggleType when clicking a pill', () => {
    const onToggle = vi.fn();
    renderWithProviders(<FilterBar {...baseProps} onToggleType={onToggle} />);
    fireEvent.click(screen.getByText('error'));
    expect(onToggle).toHaveBeenCalledWith('error');
  });

  it('disables pill when count is 0', () => {
    renderWithProviders(<FilterBar {...baseProps} counts={{ error: 0, warning: 2, restart: 1 }} />);
    const errorBtn = screen.getByText('error').closest('button')!;
    expect(errorBtn.hasAttribute('disabled')).toBe(true);
  });

  it('shows counts next to labels', () => {
    renderWithProviders(<FilterBar {...baseProps} />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('renders search input', () => {
    renderWithProviders(<FilterBar {...baseProps} />);
    expect(screen.getByRole('textbox')).toBeTruthy();
  });

  it('shows time label and clear button when timeLabel provided', () => {
    renderWithProviders(<FilterBar {...baseProps} timeLabel="10:00 → 11:00" onClearTimeFilter={vi.fn()} />);
    expect(screen.getByText('10:00 → 11:00')).toBeTruthy();
    expect(screen.getByText('Show All 24h')).toBeTruthy();
  });
});
