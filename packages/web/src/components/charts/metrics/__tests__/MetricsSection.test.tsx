import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import { MetricsSection } from '../MetricsSection';

// Mock useMetricsData
const mockUseMetricsData = vi.fn();
vi.mock('../../../../hooks/useMetricsData', () => ({
  useMetricsData: (...args: unknown[]) => mockUseMetricsData(...args),
}));

// Mock usePreview
vi.mock('../../../../hooks/usePreview', () => ({
  usePreview: () => ({
    preview: null,
    previewEvents: null,
    handleErrorClick: vi.fn(),
    handleUptimeClick: vi.fn(),
    closePreview: vi.fn(),
  }),
}));

// Mock useMetricsValidation
vi.mock('../useMetricsValidation', () => ({
  useMetricsValidation: () => [],
}));

// Mock chart components that use canvas/echarts
vi.mock('../../SessionsChart', () => ({ SessionsChart: () => <div data-testid="sessions-chart" /> }));
vi.mock('../../TokensChart', () => ({ TokensChart: () => <div data-testid="tokens-chart" /> }));
vi.mock('../ErrorsChartCard', () => ({ ErrorsChartCard: () => <div data-testid="errors-chart" /> }));
vi.mock('../UptimeChartCard', () => ({ UptimeChartCard: () => <div data-testid="uptime-chart" /> }));

afterEach(cleanup);

function makeMetricsReturn(overrides = {}) {
  return {
    metrics: { buckets: [], totalErrors: 0, totalWarnings: 0, uptimePercent: 100 },
    buckets: [],
    allModels: [],
    peakSessions: 0,
    totalTokensK: 0,
    totalMessages: 0,
    totalErrors: 0,
    totalWarnings: 0,
    uptimePct: 100,
    bucketSeconds: 300,
    lastFetchTime: Date.now(),
    fetching: false,
    result: { data: {}, fetching: false },
    ...overrides,
  };
}

describe('MetricsSection', () => {
  it('shows loading skeletons when fetching', () => {
    mockUseMetricsData.mockReturnValue(makeMetricsReturn({ fetching: true, result: { data: null, fetching: true } }));
    const { container } = renderWithProviders(<MetricsSection range="ONE_HOUR" onRangeChange={() => {}} />);
    // Skeletons use the Skeleton component with animate-pulse
    const skeletons = container.querySelectorAll('[class*="animate-pulse"], [class*="skeleton"]');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders RangePicker and chart cards when data is available', () => {
    mockUseMetricsData.mockReturnValue(makeMetricsReturn());
    const { getByText, getByTestId } = renderWithProviders(
      <MetricsSection range="SIX_HOUR" onRangeChange={() => {}} />,
    );
    // RangePicker buttons
    expect(getByText('6h')).toBeDefined();
    // Chart cards rendered
    expect(getByTestId('sessions-chart')).toBeDefined();
    expect(getByTestId('tokens-chart')).toBeDefined();
    expect(getByTestId('errors-chart')).toBeDefined();
    expect(getByTestId('uptime-chart')).toBeDefined();
  });

  it('uses container query grid class for chart layout', () => {
    mockUseMetricsData.mockReturnValue(makeMetricsReturn());
    const { container } = renderWithProviders(<MetricsSection range="SIX_HOUR" onRangeChange={() => {}} />);
    const tokensChart = container.querySelector('[data-testid="tokens-chart"]');
    const gridDiv = tokensChart?.closest('.grid');
    expect(gridDiv).toBeTruthy();
    expect(gridDiv?.className).toContain('@xl:grid-cols-2');
    // Ensure no standalone viewport variant (without @ prefix)
    const gridClasses = gridDiv?.className.split(/\s+/) ?? [];
    expect(gridClasses).not.toContain('xl:grid-cols-2');
  });

  it('skeleton grid uses container query class', () => {
    mockUseMetricsData.mockReturnValue(makeMetricsReturn({ fetching: true, result: { data: null, fetching: true } }));
    const { container } = renderWithProviders(<MetricsSection range="ONE_HOUR" onRangeChange={() => {}} />);
    const grids = container.querySelectorAll('.grid');
    const skeletonGrid = Array.from(grids).find((el) => el.className.includes('grid-cols'));
    expect(skeletonGrid?.className).toContain('@xl:grid-cols-2');
    const skeletonClasses = skeletonGrid?.className.split(/\s+/) ?? [];
    expect(skeletonClasses).not.toContain('xl:grid-cols-2');
  });

  it('renders summary row when metrics exist', () => {
    mockUseMetricsData.mockReturnValue(
      makeMetricsReturn({ totalTokensK: 42.5, totalMessages: 123, totalErrors: 3, totalWarnings: 1, uptimePct: 98.7 }),
    );
    const { container } = renderWithProviders(<MetricsSection range="ONE_HOUR" onRangeChange={() => {}} />);
    const text = container.textContent ?? '';
    expect(text).toContain('42.5k');
    expect(text).toContain('98.7%');
  });
});
