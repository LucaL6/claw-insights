import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, fireEvent, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render';
import { ActionBar } from '../ActionBar';

afterEach(cleanup);

describe('ActionBar', () => {
  const defaults = { updateLabel: null as string | null, uptime: undefined as string | undefined };

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

  it('shows update button when updateLabel is set', () => {
    const onAction = vi.fn();
    renderWithProviders(<ActionBar {...defaults} updateLabel="v2.0.0" onAction={onAction} />);
    expect(screen.getByText('v2.0.0')).toBeDefined();
    fireEvent.click(screen.getByText('v2.0.0'));
    expect(onAction).toHaveBeenCalledWith('update');
  });

  it('does not show update button when updateLabel is null', () => {
    renderWithProviders(<ActionBar {...defaults} />);
    expect(screen.queryByText('v2.0.0')).toBeNull();
  });

  it('shows uptime when provided', () => {
    renderWithProviders(<ActionBar {...defaults} uptime="3h 12m" />);
    expect(screen.getByText('⏱ 3h 12m')).toBeDefined();
  });
});
