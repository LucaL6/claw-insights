import { screen } from '@testing-library/react';
import { describe, expect,it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { AuthErrorScreen } from '../AuthErrorScreen';

describe('AuthErrorScreen', () => {
  it('renders title and command', () => {
    renderWithProviders(<AuthErrorScreen />);
    expect(screen.getByText('Session Expired')).toBeDefined();
    expect(screen.getByText('claw-insights status')).toBeDefined();
  });

  it('has a reload button', () => {
    renderWithProviders(<AuthErrorScreen />);
    expect(screen.getAllByRole('button', { name: /reload/i }).length).toBeGreaterThan(0);
  });
});
