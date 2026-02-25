import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { AuthErrorScreen } from '../AuthErrorScreen';

describe('AuthErrorScreen', () => {
  it('renders brand and title', () => {
    renderWithProviders(<AuthErrorScreen />);
    expect(screen.getByText('Claw Insights')).toBeDefined();
    expect(screen.getByText('Access Token Invalid')).toBeDefined();
  });

  it('renders possible causes', () => {
    renderWithProviders(<AuthErrorScreen />);
    expect(screen.getAllByText(/tokens regenerate/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/valid for 7 days/i).length).toBeGreaterThan(0);
  });

  it('renders recovery steps and command', () => {
    renderWithProviders(<AuthErrorScreen />);
    expect(screen.getAllByText(/run the command/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText('claw-insights status').length).toBeGreaterThan(0);
  });

  it('has a reload button', () => {
    renderWithProviders(<AuthErrorScreen />);
    expect(screen.getAllByRole('button', { name: /reload/i }).length).toBeGreaterThan(0);
  });
});
