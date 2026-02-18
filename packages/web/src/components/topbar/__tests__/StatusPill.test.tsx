import { describe, it, expect, afterEach } from 'vitest';
import { screen, cleanup } from '@testing-library/react';
import { renderWithProviders } from '../../../test/render';
import { StatusPill } from '../StatusPill';

afterEach(cleanup);

describe('StatusPill', () => {
  it('shows connecting state when fetching', () => {
    renderWithProviders(<StatusPill fetching={true} />);
    expect(screen.getByText('CONNECTING')).toBeDefined();
    const dot = screen.getByText('CONNECTING').previousElementSibling!;
    expect(dot.className).toContain('animate-pulse');
  });

  it('shows "up" when running and not fetching', () => {
    renderWithProviders(<StatusPill running={true} fetching={false} />);
    expect(screen.getByText('UP')).toBeDefined();
    const container = screen.getByText('UP').closest('div')!;
    expect(container.className).toContain('bg-emerald-bg');
  });

  it('shows "down" when not running and not fetching', () => {
    renderWithProviders(<StatusPill running={false} fetching={false} />);
    expect(screen.getByText('DOWN')).toBeDefined();
    const container = screen.getByText('DOWN').closest('div')!;
    expect(container.className).toContain('bg-red-bg');
  });
});
