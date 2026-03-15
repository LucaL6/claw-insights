import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../../test/render';
import { MetricsValidationWarnings } from '../MetricsValidationWarnings';

afterEach(cleanup);

describe('MetricsValidationWarnings', () => {
  it('returns null when warnings array is empty', () => {
    const { container } = renderWithProviders(<MetricsValidationWarnings warnings={[]} />);
    expect(container.innerHTML).toBe('');
  });

  it('renders a warn-level message with amber style', () => {
    renderWithProviders(<MetricsValidationWarnings warnings={[{ text: 'Gateway was offline', level: 'warn' }]} />);
    expect(screen.getByText('Gateway was offline')).toBeDefined();
    expect(screen.getByText('⚠️')).toBeDefined();
  });

  it('renders an info-level message with muted style', () => {
    renderWithProviders(
      <MetricsValidationWarnings warnings={[{ text: 'No activity in this time window', level: 'info' }]} />,
    );
    expect(screen.getByText('No activity in this time window')).toBeDefined();
    expect(screen.getByText('ℹ️')).toBeDefined();
  });

  it('renders multiple messages with correct icons', () => {
    const warnings = [
      { text: 'Warning one', level: 'warn' as const },
      { text: 'Info one', level: 'info' as const },
    ];
    renderWithProviders(<MetricsValidationWarnings warnings={warnings} />);
    expect(screen.getByText('Warning one')).toBeDefined();
    expect(screen.getByText('Info one')).toBeDefined();
    expect(screen.getByText('⚠️')).toBeDefined();
    expect(screen.getByText('ℹ️')).toBeDefined();
  });
});
