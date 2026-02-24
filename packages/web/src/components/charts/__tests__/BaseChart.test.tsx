import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../../../theme/context';
import { BaseChart } from '../core/BaseChart';

// Mock localStorage for ThemeProvider
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: vi.fn(() => null),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  },
  writable: true,
});

// Mock echarts-for-react — happy-dom can't render canvas
vi.mock('echarts-for-react', () => ({
  default: (props: { style?: React.CSSProperties }) => <div data-mock="echarts" style={props.style} />,
}));

vi.mock('echarts', () => ({
  registerTheme: vi.fn(),
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('BaseChart', () => {
  it('renders a container div with data-testid', () => {
    const option = {
      xAxis: { type: 'category' as const, data: ['0h', '1h'] },
      yAxis: { type: 'value' as const },
      series: [{ type: 'bar' as const, data: [1, 2] }],
    };
    const { getByTestId } = renderWithProviders(
      <BaseChart option={option} testId="test-chart" height={100} />,
    );
    expect(getByTestId('test-chart')).toBeDefined();
  });

  it('applies the correct height style', () => {
    const option = { series: [] };
    const { getByTestId } = renderWithProviders(
      <BaseChart option={option} testId="h-check" height={200} />,
    );
    expect(getByTestId('h-check').style.height).toBe('200px');
  });
});
