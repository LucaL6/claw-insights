import { cleanup,screen } from '@testing-library/react';
import { afterEach,describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import { MetricsValidationWarnings } from '../MetricsValidationWarnings';

afterEach(cleanup);

describe('MetricsValidationWarnings', () => {
  it('returns null when warnings array is empty', () => {
    const { container } = renderWithProviders(<MetricsValidationWarnings warnings={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a single warning', () => {
    renderWithProviders(<MetricsValidationWarnings warnings={['Data may be stale']} />);
    expect(screen.getByText('Data may be stale')).toBeDefined();
    expect(screen.getByText('⚠️')).toBeDefined();
  });

  it('renders multiple warnings', () => {
    const warnings = ['Warning one', 'Warning two', 'Warning three'];
    renderWithProviders(<MetricsValidationWarnings warnings={warnings} />);
    warnings.forEach((w) => {
      expect(screen.getByText(w)).toBeDefined();
    });
    expect(screen.getAllByText('⚠️')).toHaveLength(3);
  });
});
