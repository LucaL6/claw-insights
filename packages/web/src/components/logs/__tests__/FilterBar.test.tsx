import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('pills are always clickable even when count is 0', () => {
    const onToggle = vi.fn();
    renderWithProviders(
      <FilterBar {...baseProps} counts={{ error: 0, warning: 2, restart: 1 }} onToggleType={onToggle} />,
    );
    const errorBtn = screen.getByText('error').closest('button')!;
    expect(errorBtn.hasAttribute('disabled')).toBe(false);
    fireEvent.click(errorBtn);
    expect(onToggle).toHaveBeenCalledWith('error');
  });

  it('shows counts next to labels including zero counts', () => {
    renderWithProviders(<FilterBar {...baseProps} counts={{ error: 0, warning: 2, restart: 1 }} />);
    expect(screen.getByText('0')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('pills have role=checkbox and aria-checked', () => {
    renderWithProviders(
      <FilterBar {...baseProps} activeTypes={['error']} />,
    );
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    const errorBox = checkboxes.find((el) => el.textContent?.includes('error'))!;
    expect(errorBox.getAttribute('aria-checked')).toBe('true');
    const warnBox = checkboxes.find((el) => el.textContent?.includes('warn'))!;
    expect(warnBox.getAttribute('aria-checked')).toBe('false');
  });

  it('renders search input with correct placeholder', () => {
    renderWithProviders(<FilterBar {...baseProps} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.placeholder).toBe('Filter: module:name, /regex/, or text');
  });

  it('shows time label and clear button when timeLabel provided', () => {
    renderWithProviders(<FilterBar {...baseProps} timeLabel="10:00 → 11:00" onClearTimeFilter={vi.fn()} />);
    expect(screen.getByText('10:00 → 11:00')).toBeTruthy();
    expect(screen.getByText('Show All 24h')).toBeTruthy();
  });

  describe('status summary', () => {
    it('shows summary with all types', () => {
      renderWithProviders(<FilterBar {...baseProps} />);
      expect(screen.getByText('24h · all · 50 events')).toBeTruthy();
    });

    it('shows summary with specific types', () => {
      renderWithProviders(<FilterBar {...baseProps} activeTypes={['error', 'warning']} />);
      expect(screen.getByText('24h · error+warn · 50 events')).toBeTruthy();
    });

    it('shows "of total" when search is active', () => {
      renderWithProviders(<FilterBar {...baseProps} search="test" displayed={10} total={100} />);
      expect(screen.getByText('24h · all · 10 of 100 events')).toBeTruthy();
    });

    it('uses timeLabel in summary when provided', () => {
      renderWithProviders(<FilterBar {...baseProps} timeLabel="10:00 → 11:00" />);
      expect(screen.getByText('10:00 → 11:00 · all · 50 events')).toBeTruthy();
    });
  });

  describe('search error', () => {
    it('shows error indicator when searchError is true', () => {
      renderWithProviders(<FilterBar {...baseProps} searchError={true} />);
      expect(screen.getByText('⚠ invalid regex')).toBeTruthy();
    });

    it('hides error indicator when searchError is false', () => {
      renderWithProviders(<FilterBar {...baseProps} searchError={false} />);
      expect(screen.queryByText('⚠ invalid regex')).toBeNull();
    });

    it('hides error indicator by default', () => {
      renderWithProviders(<FilterBar {...baseProps} />);
      expect(screen.queryByText('⚠ invalid regex')).toBeNull();
    });
  });
});
