import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EventRow } from '../EventRow';

afterEach(cleanup);

const base = { timestamp: '2026-01-15T14:30:00Z', module: 'gateway', message: 'something happened', highlighted: false };

describe('EventRow', () => {
  it('renders level badge, module, and message', () => {
    render(<EventRow {...base} type="error" />);
    expect(screen.getByText('ERROR')).toBeTruthy();
    expect(screen.getByText('gateway')).toBeTruthy();
    expect(screen.getByText('something happened')).toBeTruthy();
  });

  it('renders WARN badge for warning type', () => {
    render(<EventRow {...base} type="warning" />);
    expect(screen.getByText('WARN')).toBeTruthy();
  });

  it('renders RESTART badge for gateway_restart type', () => {
    render(<EventRow {...base} type="gateway_restart" />);
    expect(screen.getByText('RESTART')).toBeTruthy();
  });

  it('falls back to error style for unknown type', () => {
    render(<EventRow {...base} type="unknown_type" />);
    expect(screen.getByText('ERROR')).toBeTruthy();
  });

  it('applies highlight background when highlighted', () => {
    const { container } = render(<EventRow {...base} type="error" highlighted />);
    const row = container.firstChild as HTMLElement;
    expect(row.style.backgroundColor).not.toBe('transparent');
  });
});
