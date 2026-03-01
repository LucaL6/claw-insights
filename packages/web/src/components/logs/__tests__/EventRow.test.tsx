import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders as render } from '../../../test/render';
import { EventRow } from '../EventRow';

afterEach(cleanup);

const base = {
  id: 'event-0',
  timestamp: '2026-01-15T14:30:00Z',
  module: 'gateway',
  message: 'something happened',
  expanded: false,
  tabIndex: 0,
  onToggle: vi.fn(),
  onKeyDown: vi.fn(),
};

describe('EventRow', () => {
  it('renders compact row with ERR abbreviation', () => {
    render(<EventRow {...base} type="error" />);
    expect(screen.getByText('ERR')).toBeTruthy();
    expect(screen.getByText('gateway')).toBeTruthy();
    expect(screen.getByText('something happened')).toBeTruthy();
  });

  it('renders WRN for warning type', () => {
    render(<EventRow {...base} type="warning" />);
    expect(screen.getByText('WRN')).toBeTruthy();
  });

  it('renders RST for gateway_restart type', () => {
    render(<EventRow {...base} type="gateway_restart" />);
    expect(screen.getByText('RST')).toBeTruthy();
  });

  it('has role="listitem" and aria-expanded=false when collapsed', () => {
    const { container } = render(<EventRow {...base} type="error" />);
    const row = container.firstChild as HTMLElement;
    expect(row.getAttribute('role')).toBe('listitem');
    expect(row.getAttribute('aria-expanded')).toBe('false');
  });

  it('has aria-expanded=true when expanded', () => {
    const { container } = render(<EventRow {...base} type="error" expanded />);
    const row = container.firstChild as HTMLElement;
    expect(row.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows repeat stats when expanded with repeatCount', () => {
    render(<EventRow {...base} type="error" expanded repeatCount={5} repeatFirst="2026-01-15T14:25:00Z" />);
    expect(screen.getAllByText(/×5/).length).toBeGreaterThanOrEqual(1);
  });

  it('calls onToggle on click', () => {
    const onToggle = vi.fn();
    const { container } = render(<EventRow {...base} type="error" onToggle={onToggle} />);
    fireEvent.click(container.firstChild as HTMLElement);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('calls onKeyDown on keyboard event', () => {
    const onKeyDown = vi.fn();
    const { container } = render(<EventRow {...base} type="error" onKeyDown={onKeyDown} />);
    fireEvent.keyDown(container.firstChild as HTMLElement, { key: 'Enter' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('has correct id prop', () => {
    const { container } = render(<EventRow {...base} type="error" />);
    expect((container.firstChild as HTMLElement).id).toBe('event-0');
  });
});
