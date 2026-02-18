import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders } from '../../../test/render';

// Mock BaseChart to avoid echarts dependency
vi.mock('../core/BaseChart', () => ({
  BaseChart: ({ testId }: { testId?: string }) => <div data-testid={testId ?? 'base-chart'} />,
}));

// Mock builders to return empty objects
vi.mock('../builders/buildErrorsOption', () => ({ buildErrorsOption: () => ({}) }));
vi.mock('../builders/buildSessionsOption', () => ({ buildSessionsOption: () => ({}) }));
vi.mock('../builders/buildTokensOption', () => ({ buildTokensOption: () => ({}) }));
vi.mock('../builders/buildUptimeOption', () => ({ buildUptimeOption: () => ({}) }));

import { ErrorsChart } from '../ErrorsChart';
import { SessionsChart } from '../SessionsChart';
import { TokensChart } from '../TokensChart';
import { UptimeStrip } from '../UptimeStrip';

describe('ErrorsChart', () => {
  it('renders with empty data', () => {
    const { getByTestId } = renderWithProviders(<ErrorsChart data={[]} />);
    expect(getByTestId('errors-chart')).toBeTruthy();
  });
});

describe('SessionsChart', () => {
  it('renders with empty data', () => {
    const { getByTestId } = renderWithProviders(<SessionsChart data={[]} />);
    expect(getByTestId('sessions-chart')).toBeTruthy();
  });
});

describe('TokensChart', () => {
  it('renders with empty data', () => {
    const { getByTestId } = renderWithProviders(<TokensChart data={[]} />);
    expect(getByTestId('tokens-chart')).toBeTruthy();
  });
});

describe('UptimeStrip', () => {
  it('renders with empty data', () => {
    const { getByTestId } = renderWithProviders(<UptimeStrip data={[]} />);
    expect(getByTestId('uptime-chart')).toBeTruthy();
  });
});
