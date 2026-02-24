import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render';
import { ActionBar } from '../ActionBar';

afterEach(cleanup);

describe('ActionBar', () => {
  const defaults = { uptime: undefined as string | undefined };

  it('renders restart and doctor buttons', () => {
    renderWithProviders(<ActionBar {...defaults} />);
    expect(screen.getByText('Restart')).toBeDefined();
    expect(screen.getByText('Doctor')).toBeDefined();
  });

  it('calls onAction with correct type on click', () => {
    const onAction = vi.fn();
    renderWithProviders(<ActionBar {...defaults} onAction={onAction} />);
    fireEvent.click(screen.getByText('Restart'));
    expect(onAction).toHaveBeenCalledWith('restart');
    fireEvent.click(screen.getByText('Doctor'));
    expect(onAction).toHaveBeenCalledWith('doctor');
  });

  it('does not show update button', () => {
    renderWithProviders(<ActionBar {...defaults} />);
    expect(screen.queryByText(/v\d+\.\d+\.\d+/)).toBeNull();
  });

  it('shows uptime when provided', () => {
    renderWithProviders(<ActionBar {...defaults} uptime="3h 12m" />);
    expect(screen.getByText('⏱ 3h 12m')).toBeDefined();
  });
});
