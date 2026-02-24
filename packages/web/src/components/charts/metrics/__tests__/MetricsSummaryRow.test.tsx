import { cleanup } from '@testing-library/react';
import { afterEach,describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import { MetricsSummaryRow } from '../MetricsSummaryRow';

afterEach(cleanup);

describe('MetricsSummaryRow', () => {
  it('renders formatted values', () => {
    const { container } = renderWithProviders(
      <MetricsSummaryRow totalTokensK={123.456} totalErrors={5} totalWarnings={2} uptimePct={99.123} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('123.5k');
    expect(text).toContain('5');
    expect(text).toContain('2');
    expect(text).toContain('99.1%');
  });

  it('handles zero values', () => {
    const { container } = renderWithProviders(
      <MetricsSummaryRow totalTokensK={0} totalErrors={0} totalWarnings={0} uptimePct={0} />,
    );
    const text = container.textContent ?? '';
    expect(text).toContain('0.0k');
    expect(text).toContain('0.0%');
  });
});
