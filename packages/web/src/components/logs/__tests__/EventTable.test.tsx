import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EventTable } from '../EventTable';

afterEach(cleanup);

const events = [
  { timestamp: '2026-01-15T10:00:00Z', type: 'error', module: 'gw', message: 'disk full' },
  { timestamp: '2026-01-15T11:00:00Z', type: 'warning', module: 'api', message: 'slow query' },
];

describe('EventTable', () => {
  it('renders rows from data array', () => {
    render(<EventTable events={events} search="" />);
    expect(screen.getByText('disk full')).toBeTruthy();
    expect(screen.getByText('slow query')).toBeTruthy();
  });

  it('shows empty state when no events match', () => {
    render(<EventTable events={[]} search="" />);
    expect(screen.getByText('No events match filters')).toBeTruthy();
  });

  it('shows empty state when search filters everything out', () => {
    render(<EventTable events={events} search="zzzzz" />);
    expect(screen.getByText('No events match filters')).toBeTruthy();
  });

  it('shows loading state', () => {
    render(<EventTable events={[]} search="" loading />);
    expect(screen.getByText('Loading events...')).toBeTruthy();
  });

  it('shows error state', () => {
    render(<EventTable events={[]} search="" error="oops" />);
    expect(screen.getByText('Failed to load events')).toBeTruthy();
  });

  it('renders header columns', () => {
    render(<EventTable events={events} search="" />);
    expect(screen.getByText('Time')).toBeTruthy();
    expect(screen.getByText('Level')).toBeTruthy();
    expect(screen.getByText('Module')).toBeTruthy();
    expect(screen.getByText('Message')).toBeTruthy();
  });
});
