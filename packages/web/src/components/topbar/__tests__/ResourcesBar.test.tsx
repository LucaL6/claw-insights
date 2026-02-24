import { cleanup,screen } from '@testing-library/react';
import { afterEach,describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { ResourcesBar } from '../ResourcesBar';

afterEach(cleanup);

describe('ResourcesBar', () => {
  it('renders CPU and memory values', () => {
    renderWithProviders(<ResourcesBar resources={{ cpu: 12.345, memoryMB: 128 }} fetching={false} />);
    expect(screen.getByText('12.3%')).toBeDefined();
    expect(screen.getByText('128M')).toBeDefined();
    expect(screen.getByText('CPU')).toBeDefined();
    expect(screen.getByText('MEM')).toBeDefined();
  });

  it('returns null when resources is null', () => {
    const { container } = renderWithProviders(<ResourcesBar resources={null} fetching={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('returns null when resources is undefined', () => {
    const { container } = renderWithProviders(<ResourcesBar fetching={false} />);
    expect(container.innerHTML).toBe('');
  });

  it('shows skeleton when fetching', () => {
    const { container } = renderWithProviders(<ResourcesBar fetching={true} />);
    expect(container.querySelectorAll('.bg-skeleton').length).toBe(2);
    expect(screen.getByText('CPU')).toBeDefined();
  });
});
