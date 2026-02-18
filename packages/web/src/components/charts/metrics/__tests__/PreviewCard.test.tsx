import { describe, it, expect, vi, afterEach } from 'vitest';
import { screen, cleanup, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '../../../../test/render';
import { PreviewCard } from '../PreviewCard';

afterEach(cleanup);

const baseProps = {
  source: 'errors' as const,
  title: 'Errors',
  timeLabel: '10:00-11:00',
  events: [],
  total: 0,
  linkHref: '#logs',
  onClose: vi.fn(),
  onNavigate: vi.fn(),
};

describe('PreviewCard', () => {
  it('renders header with title and time label', () => {
    renderWithProviders(<PreviewCard {...baseProps} />);
    expect(screen.getByText('Errors')).toBeDefined();
    expect(screen.getByText('10:00-11:00')).toBeDefined();
  });

  it('shows total count', () => {
    renderWithProviders(<PreviewCard {...baseProps} total={5} />);
    expect(screen.getByText('5')).toBeDefined();
  });

  it('shows "no events" message when events list is empty', () => {
    renderWithProviders(<PreviewCard {...baseProps} />);
    // The i18n key 'logs.noEvents' should render something
    expect(screen.getByText(/no.*event/i)).toBeDefined();
  });

  it('renders event rows', () => {
    const events = [
      { timestamp: '2026-01-01T10:30:00Z', type: 'error', module: 'gateway', message: 'Connection lost' },
      { timestamp: '2026-01-01T10:31:00Z', type: 'warning', module: 'sessions', message: 'Timeout' },
    ];
    renderWithProviders(<PreviewCard {...baseProps} events={events} total={2} />);
    expect(screen.getByText('Connection lost')).toBeDefined();
    expect(screen.getByText('Timeout')).toBeDefined();
    expect(screen.getByText('ERR')).toBeDefined();
    expect(screen.getByText('WRN')).toBeDefined();
  });

  it('renders gateway_restart event type', () => {
    const events = [
      { timestamp: '2026-01-01T10:30:00Z', type: 'gateway_restart', module: 'gw', message: 'Restarted' },
    ];
    renderWithProviders(<PreviewCard {...baseProps} source="uptime" events={events} total={1} />);
    expect(screen.getByText('RST')).toBeDefined();
  });

  it('renders unknown event type with 3-char abbreviation', () => {
    const events = [
      { timestamp: '2026-01-01T10:30:00Z', type: 'custom_type', module: 'x', message: 'Custom' },
    ];
    renderWithProviders(<PreviewCard {...baseProps} events={events} total={1} />);
    expect(screen.getByText('CUS')).toBeDefined();
  });

  it('falls back to module when message is empty', () => {
    const events = [
      { timestamp: '2026-01-01T10:30:00Z', type: 'error', module: 'fallback-mod', message: '' },
    ];
    renderWithProviders(<PreviewCard {...baseProps} events={events} total={1} />);
    expect(screen.getByText('fallback-mod')).toBeDefined();
  });

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn();
    renderWithProviders(<PreviewCard {...baseProps} onClose={onClose} />);
    fireEvent.click(screen.getByText('✕'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onNavigate when "view all" clicked', () => {
    const onNavigate = vi.fn();
    renderWithProviders(<PreviewCard {...baseProps} onNavigate={onNavigate} />);
    const viewAll = screen.getByText(/view.*all/i);
    fireEvent.click(viewAll);
    expect(onNavigate).toHaveBeenCalledWith('#logs');
  });

  it('shows event count footer', () => {
    const events = [
      { timestamp: '2026-01-01T10:30:00Z', type: 'error', module: 'gw', message: 'err1' },
    ];
    renderWithProviders(<PreviewCard {...baseProps} events={events} total={10} />);
    expect(screen.getByText('1 of 10')).toBeDefined();
  });

  it('formats time correctly', () => {
    const events = [
      { timestamp: '2026-01-01T14:30:45Z', type: 'error', module: 'x', message: 'test' },
    ];
    renderWithProviders(<PreviewCard {...baseProps} events={events} total={1} />);
    // Time should be formatted as HH:MM:SS
    const timeEl = screen.getByText(/\d{2}:\d{2}:\d{2}/);
    expect(timeEl).toBeDefined();
  });
});
