import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BaseChart } from '../BaseChart';

describe('BaseChart', () => {
  it('renders a container div with data-testid', () => {
    const option = {
      xAxis: { type: 'category' as const, data: ['0h', '1h'] },
      yAxis: { type: 'value' as const },
      series: [{ type: 'bar' as const, data: [1, 2] }],
    };
    const { getByTestId } = render(<BaseChart option={option} testId="test-chart" height={100} />);
    expect(getByTestId('test-chart')).toBeDefined();
  });

  it('applies the correct height style', () => {
    const option = { series: [] };
    const { getByTestId } = render(<BaseChart option={option} testId="h-check" height={200} />);
    expect(getByTestId('h-check').style.height).toBe('200px');
  });
});
