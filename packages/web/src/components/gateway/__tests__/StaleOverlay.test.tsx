import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../hooks/useConnectionStatus', () => ({
  useConnectionStatus: vi.fn(),
}));

vi.mock('../../../i18n/context', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import { useConnectionStatus } from '../../../hooks/useConnectionStatus';
import { StaleOverlay } from '../StaleOverlay';

const mockUseConnectionStatus = vi.mocked(useConnectionStatus);

describe('StaleOverlay', () => {
  afterEach(cleanup);

  it('renders nothing when connected', () => {
    mockUseConnectionStatus.mockReturnValue('connected');
    const { container } = render(<StaleOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when connecting', () => {
    mockUseConnectionStatus.mockReturnValue('connecting');
    const { container } = render(<StaleOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay when reconnecting (dashboard offline)', () => {
    mockUseConnectionStatus.mockReturnValue('reconnecting');
    render(<StaleOverlay />);
    expect(screen.getByTestId('stale-overlay')).toBeDefined();
  });

  it('overlay has pointer-events-none and data-testid', () => {
    mockUseConnectionStatus.mockReturnValue('reconnecting');
    render(<StaleOverlay />);
    const overlay = screen.getByTestId('stale-overlay');
    expect(overlay.className).toContain('pointer-events-none');
  });
});
