import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { MainLayout } from '../MainLayout';

function mockMatchMedia(matches: boolean) {
  Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: matches ? 600 : 1024 });
  window.matchMedia = (query: string) =>
    ({
      matches,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

describe('MainLayout', () => {
  afterEach(() => cleanup());

  it('renders children in correct sections', () => {
    mockMatchMedia(false);
    const { getByText } = renderWithProviders(
      <MainLayout topBar={<div>TopBar</div>} sessions={<div>Sessions</div>} metrics={<div>Metrics</div>} />,
    );
    expect(getByText('TopBar')).toBeTruthy();
    expect(getByText('Sessions')).toBeTruthy();
    expect(getByText('Metrics')).toBeTruthy();
  });

  it('has header and main elements', () => {
    mockMatchMedia(false);
    const { container } = renderWithProviders(<MainLayout topBar={<span />} sessions={<span />} metrics={<span />} />);
    expect(container.querySelector('header')).toBeTruthy();
    expect(container.querySelector('main')).toBeTruthy();
  });

  it('has sessions and metrics data-sections', () => {
    mockMatchMedia(false);
    const { container } = renderWithProviders(<MainLayout topBar={<span />} sessions={<span />} metrics={<span />} />);
    expect(container.querySelector('[data-section="sessions"]')).toBeTruthy();
    expect(container.querySelector('[data-section="metrics"]')).toBeTruthy();
  });

  // Tab mode tests (< 768px)
  it('renders tab layout below md breakpoint', () => {
    mockMatchMedia(true);
    const { container } = renderWithProviders(
      <MainLayout topBar={<span />} sessions={<div>Sessions</div>} metrics={<div>Metrics</div>} />,
    );
    expect(container.querySelector('[role="tablist"]')).toBeTruthy();
    expect(container.querySelector('[role="tab"]')).toBeTruthy();
    expect(container.querySelector('[role="tabpanel"]')).toBeTruthy();
    // No data-section in tab mode
    expect(container.querySelector('[data-section="sessions"]')).toBeNull();
  });

  it('switches tabs in tab mode', () => {
    mockMatchMedia(true);
    const { container } = renderWithProviders(
      <MainLayout topBar={<span />} sessions={<div>SessionContent</div>} metrics={<div>MetricContent</div>} />,
    );
    const tabs = screen.getAllByRole('tab');
    const sessionsPanel = container.querySelector('#tabpanel-sessions') as HTMLElement;
    const metricsPanel = container.querySelector('#tabpanel-metrics') as HTMLElement;

    // Sessions tab active by default
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
    expect(sessionsPanel.classList.contains('hidden')).toBe(false);
    expect(metricsPanel.classList.contains('hidden')).toBe(true);

    // Click metrics tab
    fireEvent.click(tabs[1]);
    expect(tabs[0].getAttribute('aria-selected')).toBe('false');
    expect(tabs[1].getAttribute('aria-selected')).toBe('true');
    expect(sessionsPanel.classList.contains('hidden')).toBe(true);
    expect(metricsPanel.classList.contains('hidden')).toBe(false);
  });

  it('keeps both panels mounted in tab mode', () => {
    mockMatchMedia(true);
    const { getByText } = renderWithProviders(
      <MainLayout topBar={<span />} sessions={<div>SessionContent</div>} metrics={<div>MetricContent</div>} />,
    );
    // Both contents are in the DOM even when one is hidden
    expect(getByText('SessionContent')).toBeTruthy();
    expect(getByText('MetricContent')).toBeTruthy();
  });
});
