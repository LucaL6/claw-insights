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

const longMessage = Array.from({ length: 6 }, (_, i) => `line ${i + 1} with long wrapped content`).join('\n');

describe('EventRow', () => {
  it('renders compact row with ERR abbreviation', () => {
    render(<EventRow {...base} type="error" />);
    expect(screen.getByText('ERR')).toBeTruthy();
    expect(screen.getByText('gateway')).toBeTruthy();
    expect(screen.getByText('something happened')).toBeTruthy();
  });

  it('clamps long compact message preview to two lines', () => {
    render(<EventRow {...base} type="error" message={longMessage} />);
    const preview = screen.getByText(
      (content, node) =>
        node?.tagName.toLowerCase() === 'span' &&
        content.includes('line 1 with long wrapped content') &&
        content.includes('line 6 with long wrapped content'),
    );
    expect(preview.className).toContain('[display:-webkit-box]');
    expect(preview.className).toContain('[-webkit-line-clamp:2]');
    expect(preview.className).toContain('[-webkit-box-orient:vertical]');

    const styleAttr = preview.getAttribute('style') ?? '';
    expect(styleAttr).toContain('overflow: hidden;');
    expect(styleAttr).toContain('white-space: pre-wrap;');
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

  it('calls onToggle when compact row content is clicked', () => {
    const onToggle = vi.fn();
    render(<EventRow {...base} type="error" onToggle={onToggle} />);
    fireEvent.click(screen.getByText('something happened'));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not call onToggle when expanded detail content is clicked', () => {
    const onToggle = vi.fn();
    const { container } = render(<EventRow {...base} type="error" expanded onToggle={onToggle} />);
    const detailPre = container.querySelector('[role="region"] pre');
    expect(detailPre).toBeTruthy();
    fireEvent.click(detailPre as HTMLElement);
    expect(onToggle).toHaveBeenCalledTimes(0);
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

  it('applies readable monospace styling in expanded detail', () => {
    const { container } = render(<EventRow {...base} type="error" expanded />);

    const pre = container.querySelector('pre');
    expect(pre).toBeTruthy();
    expect(pre?.className).toContain('mono');
    expect(pre?.className).toContain('leading-[1.55]');
    expect(pre?.className).toContain('tracking-[0.01em]');
    expect(pre?.className).toContain('font-medium');
    expect(pre?.className).toContain('[font-variant-ligatures:none]');

    const metadata = container.querySelector('[role="region"] .flex.items-center');
    expect(metadata?.className).toContain('gap-4');
    expect(metadata?.className).toContain('text-[11px]');
  });
});
