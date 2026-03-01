import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { renderWithProviders as render } from '../../../test/render';
import { EventTable, formatGap, type ProcessedEvent } from '../EventTable';

afterEach(cleanup);

const events: ProcessedEvent[] = [
  { timestamp: '2026-01-15T10:00:00Z', type: 'error', module: 'gw', message: 'disk full' },
  { timestamp: '2026-01-15T11:00:00Z', type: 'warning', module: 'api', message: 'slow query' },
];

describe('EventTable', () => {
  it('renders rows from data array', () => {
    render(<EventTable events={events} />);
    expect(screen.getByText('disk full')).toBeTruthy();
    expect(screen.getByText('slow query')).toBeTruthy();
  });

  it('has role="list" container', () => {
    render(<EventTable events={events} />);
    expect(screen.getByRole('list')).toBeTruthy();
  });

  it('shows empty state when no events', () => {
    render(<EventTable events={[]} />);
    expect(screen.getByText('No events match filters')).toBeTruthy();
  });

  it('shows loading state', () => {
    render(<EventTable events={[]} loading />);
    expect(screen.getByText('Loading events…')).toBeTruthy();
  });

  it('shows error state', () => {
    render(<EventTable events={[]} error="oops" />);
    expect(screen.getByText('Failed to load events')).toBeTruthy();
  });

  it('renders gap indicator for events with gapBefore', () => {
    const eventsWithGap: ProcessedEvent[] = [
      { timestamp: '2026-01-15T10:00:00Z', type: 'error', module: 'gw', message: 'first' },
      { timestamp: '2026-01-15T10:30:00Z', type: 'error', module: 'gw', message: 'second', gapBefore: 1800 },
    ];
    render(<EventTable events={eventsWithGap} />);
    expect(screen.getByRole('separator')).toBeTruthy();
    expect(screen.getByText(/30m gap/)).toBeTruthy();
  });

  it('accordion: only one row expanded at a time', () => {
    render(<EventTable events={events} />);
    const items = screen.getAllByRole('listitem');
    // Click first row
    fireEvent.click(items[0]);
    expect(items[0].getAttribute('aria-expanded')).toBe('true');
    expect(items[1].getAttribute('aria-expanded')).toBe('false');
    // Click second row
    fireEvent.click(items[1]);
    expect(items[0].getAttribute('aria-expanded')).toBe('false');
    expect(items[1].getAttribute('aria-expanded')).toBe('true');
  });

  it('collapses expanded row when events change', () => {
    const { rerender } = render(<EventTable events={events} />);
    const items = screen.getAllByRole('listitem');
    fireEvent.click(items[0]);
    expect(items[0].getAttribute('aria-expanded')).toBe('true');
    // Re-render with new events ref
    const newEvents = [...events];
    rerender(<EventTable events={newEvents} />);
    const updatedItems = screen.getAllByRole('listitem');
    expect(updatedItems[0].getAttribute('aria-expanded')).toBe('false');
  });
});

describe('EventTable keyboard navigation', () => {
  it('expands row on Enter key', () => {
    render(<EventTable events={events} />);
    const items = screen.getAllByRole('listitem');
    fireEvent.keyDown(items[0], { key: 'Enter' });
    expect(items[0].getAttribute('aria-expanded')).toBe('true');
  });

  it('expands row on Space key', () => {
    render(<EventTable events={events} />);
    const items = screen.getAllByRole('listitem');
    fireEvent.keyDown(items[0], { key: ' ' });
    expect(items[0].getAttribute('aria-expanded')).toBe('true');
  });

  it('collapses expanded row on Escape', () => {
    render(<EventTable events={events} />);
    const items = screen.getAllByRole('listitem');
    fireEvent.keyDown(items[0], { key: 'Enter' });
    expect(items[0].getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(items[0], { key: 'Escape' });
    expect(items[0].getAttribute('aria-expanded')).toBe('false');
  });

  it('moves focus down with ArrowDown', () => {
    render(<EventTable events={events} />);
    const items = screen.getAllByRole('listitem');
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    // Second row should now have tabIndex=0
    expect(items[1].getAttribute('tabindex')).toBe('0');
  });

  it('moves focus up with ArrowUp', () => {
    render(<EventTable events={events} />);
    const items = screen.getAllByRole('listitem');
    // First move down then up
    fireEvent.keyDown(items[0], { key: 'ArrowDown' });
    fireEvent.keyDown(items[1], { key: 'ArrowUp' });
    expect(items[0].getAttribute('tabindex')).toBe('0');
  });

  it('clamps ArrowDown at last item', () => {
    render(<EventTable events={events} />);
    const items = screen.getAllByRole('listitem');
    fireEvent.keyDown(items[1], { key: 'ArrowDown' });
    expect(items[1].getAttribute('tabindex')).toBe('0');
  });

  it('clamps ArrowUp at first item', () => {
    render(<EventTable events={events} />);
    const items = screen.getAllByRole('listitem');
    fireEvent.keyDown(items[0], { key: 'ArrowUp' });
    expect(items[0].getAttribute('tabindex')).toBe('0');
  });
});

describe('formatGap', () => {
  it('formats minutes', () => {
    expect(formatGap(300)).toBe('5m');
    expect(formatGap(3540)).toBe('59m');
  });

  it('formats hours', () => {
    expect(formatGap(3600)).toBe('1h');
    expect(formatGap(5400)).toBe('1h 30m');
  });

  it('formats days', () => {
    expect(formatGap(86400)).toBe('1d');
    expect(formatGap(90000)).toBe('1d 1h');
  });
});
