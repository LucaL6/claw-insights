import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { MainLayout } from '../MainLayout';

describe('MainLayout', () => {
  afterEach(() => cleanup());
  it('renders children in correct sections', () => {
    const { getByText } = renderWithProviders(
      <MainLayout topBar={<div>TopBar</div>} sessions={<div>Sessions</div>} metrics={<div>Metrics</div>} />,
    );
    expect(getByText('TopBar')).toBeTruthy();
    expect(getByText('Sessions')).toBeTruthy();
    expect(getByText('Metrics')).toBeTruthy();
  });

  it('has header and main elements', () => {
    const { container } = renderWithProviders(<MainLayout topBar={<span />} sessions={<span />} metrics={<span />} />);
    expect(container.querySelector('header')).toBeTruthy();
    expect(container.querySelector('main')).toBeTruthy();
  });

  it('has sessions and metrics data-sections', () => {
    const { container } = renderWithProviders(<MainLayout topBar={<span />} sessions={<span />} metrics={<span />} />);
    expect(container.querySelector('[data-section="sessions"]')).toBeTruthy();
    expect(container.querySelector('[data-section="metrics"]')).toBeTruthy();
  });

  it('renders banner slot between header and main content', () => {
    renderWithProviders(
      <MainLayout
        topBar={<div data-testid="topbar" />}
        banner={<div data-testid="banner">Gateway Banner</div>}
        sessions={<div />}
        metrics={<div />}
      />,
    );
    expect(screen.getByTestId('banner')).toBeDefined();
    expect(screen.getByText('Gateway Banner')).toBeDefined();
  });

  it('renders without banner (optional prop)', () => {
    renderWithProviders(<MainLayout topBar={<div data-testid="topbar" />} sessions={<div />} metrics={<div />} />);
    expect(screen.queryByTestId('banner')).toBeNull();
  });
});
