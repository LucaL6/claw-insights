import { cleanup } from '@testing-library/react';
import { afterEach,describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { ChannelPills } from '../ChannelPills';

afterEach(cleanup);

const channels = [
  { name: 'discord', provider: 'discord' as const, connected: true, latencyMs: 42 },
  { name: 'telegram', provider: 'telegram' as const, connected: false, latencyMs: null },
];

describe('ChannelPills', () => {
  it('renders one pill per channel', () => {
    const { container } = renderWithProviders(<ChannelPills channels={channels} fetching={false} />);
    const pills = container.querySelectorAll('.bg-surface');
    expect(pills.length).toBe(2);
  });

  it('shows connected (emerald) vs disconnected (red) dot', () => {
    const { container } = renderWithProviders(<ChannelPills channels={channels} fetching={false} />);
    const dots = container.querySelectorAll('[class*="rounded-full"]');
    expect(dots[0].className).toContain('bg-emerald');
    expect(dots[1].className).toContain('bg-red');
  });

  it('renders nothing for empty channels', () => {
    const { container } = renderWithProviders(<ChannelPills channels={[]} fetching={false} />);
    expect(container.querySelector('.bg-surface')).toBeNull();
  });

  it('shows skeleton when fetching', () => {
    const { container } = renderWithProviders(<ChannelPills channels={[]} fetching={true} />);
    expect(container.querySelector('.bg-skeleton')).not.toBeNull();
  });
});
