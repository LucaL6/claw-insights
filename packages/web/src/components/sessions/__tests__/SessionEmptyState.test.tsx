import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { SessionEmptyState } from '../SessionEmptyState';
import { renderWithI18n } from './testUtils';

afterEach(cleanup);

describe('SessionEmptyState', () => {
  it('renders active mode with correct title', () => {
    const { getByText } = renderWithI18n(<SessionEmptyState mode="active" />);
    expect(getByText('No active sessions')).toBeDefined();
    expect(getByText('Sessions will appear here once started')).toBeDefined();
  });

  it('renders all mode with correct title', () => {
    const { getByText } = renderWithI18n(<SessionEmptyState mode="all" />);
    expect(getByText('No session records')).toBeDefined();
    expect(getByText('All sessions will be archived here after connecting a data source')).toBeDefined();
  });

  it('shows status legend with Active, Idle, Done', () => {
    const { container } = renderWithI18n(<SessionEmptyState mode="active" />);
    const text = container.textContent ?? '';
    expect(text).toContain('Active');
    expect(text).toContain('Idle');
    expect(text).toContain('Done');
    expect(text).toContain('<30m');
    expect(text).toContain('30m–24h');
    expect(text).toContain('>24h');
  });

  it('renders chat icon SVG', () => {
    const { container } = renderWithI18n(<SessionEmptyState mode="active" />);
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
  });
});
