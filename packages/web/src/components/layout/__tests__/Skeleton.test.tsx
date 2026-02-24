import { describe, expect,it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { ChartSkeleton, SessionSkeleton,Skeleton } from '../Skeleton';

describe('Skeleton', () => {
  it('renders a pulse element', () => {
    const { container } = renderWithProviders(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain('animate-pulse');
  });

  it('applies custom className', () => {
    const { container } = renderWithProviders(<Skeleton className="h-4 w-32" />);
    expect((container.firstChild as HTMLElement).className).toContain('h-4');
  });
});

describe('ChartSkeleton', () => {
  it('renders skeleton items', () => {
    const { container } = renderWithProviders(<ChartSkeleton />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBe(3); // title, value, chart area
  });
});

describe('SessionSkeleton', () => {
  it('renders multiple skeleton items', () => {
    const { container } = renderWithProviders(<SessionSkeleton />);
    const pulses = container.querySelectorAll('.animate-pulse');
    expect(pulses.length).toBeGreaterThanOrEqual(5);
  });
});
