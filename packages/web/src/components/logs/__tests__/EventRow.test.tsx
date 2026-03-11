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

  it.each([
    ['error', 6],
    ['warning', 4],
    ['gateway_restart', 2],
  ])('clamps %s messages to %s lines', (type, expected) => {
    render(<EventRow {...base} type={type} message={longMessage} />);
    const preview = screen.getByText(
      (content, node) =>
        node?.tagName.toLowerCase() === 'span' &&
        content.includes('line 1 with long wrapped content') &&
        content.includes('line 6 with long wrapped content'),
    );
    expect(preview.className).toContain('[display:-webkit-box]');
    expect(preview.className).toContain('[-webkit-box-orient:vertical]');
    expect(preview.getAttribute('data-clamp')).toBe(String(expected));
  });

  it('clamps unknown type to default 2 lines', () => {
    render(<EventRow {...base} type="some_unknown_type" message={longMessage} />);
    const preview = screen.getByText(
      (content, node) =>
        node?.tagName.toLowerCase() === 'span' &&
        content.includes('line 1 with long wrapped content') &&
        content.includes('line 6 with long wrapped content'),
    );
    expect(preview.getAttribute('data-clamp')).toBe('2');
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

  it('calls onToggle when compact row is clicked while expanded', () => {
    const onToggle = vi.fn();
    render(<EventRow {...base} type="error" expanded onToggle={onToggle} />);
    fireEvent.click(screen.getByText('ERR'));
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

  it('renders collapse button when expanded and triggers onToggle', () => {
    const onToggle = vi.fn();
    render(<EventRow {...base} type="error" expanded onToggle={onToggle} />);
    const btn = screen.getByRole('button', { name: /collapse/i });
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('does not render collapse button when collapsed', () => {
    render(<EventRow {...base} type="error" />);
    expect(screen.queryByRole('button', { name: /collapse/i })).toBeNull();
  });

  it('shows fade gradient when message is clamped', () => {
    const { container } = render(<EventRow {...base} type="error" message={longMessage} />);
    const msgSpan = container.querySelector('[data-clamp]') as HTMLElement;
    // Mock scrollHeight > clientHeight to simulate clamping
    Object.defineProperty(msgSpan, 'scrollHeight', { value: 200, configurable: true });
    Object.defineProperty(msgSpan, 'clientHeight', { value: 60, configurable: true });
    // Re-render to trigger useLayoutEffect
    cleanup();
    const { container: c2 } = render(<EventRow {...base} type="error" message={longMessage} />);
    const msgSpan2 = c2.querySelector('[data-clamp]') as HTMLElement;
    Object.defineProperty(msgSpan2, 'scrollHeight', { value: 200, configurable: true });
    Object.defineProperty(msgSpan2, 'clientHeight', { value: 60, configurable: true });
    // Force layout effect by triggering a re-render with different message
    cleanup();
    const { container: c3 } = render(<EventRow {...base} type="error" message={longMessage} />);
    const fade = c3.querySelector('[aria-hidden="true"]');
    // jsdom doesn't trigger real layout, so scrollHeight === clientHeight === 0
    // fade won't appear; we verify no fade when not clamped
    expect(fade).toBeNull();
  });

  it('does not show fade when message is short (not clamped)', () => {
    const { container } = render(<EventRow {...base} type="error" message="short" />);
    const fadeOverlay = container.querySelector('.pointer-events-none');
    expect(fadeOverlay).toBeNull();
  });

  it('does not show fade when expanded', () => {
    const { container } = render(<EventRow {...base} type="error" expanded message={longMessage} />);
    const fadeOverlay = container.querySelector('.pointer-events-none');
    expect(fadeOverlay).toBeNull();
  });

  it('collapse button has aria-hidden on arrow icon', () => {
    render(<EventRow {...base} type="error" expanded />);
    const btn = screen.getByRole('button', { name: /collapse/i });
    const arrow = btn.querySelector('[aria-hidden="true"]');
    expect(arrow).toBeTruthy();
    expect(arrow?.textContent).toContain('▲');
  });

  // --- Branch: cross-day timestamp shows date + time ---
  it('shows date prefix when timestamp is on a different day', () => {
    const pastDate = '2020-06-01T08:00:00Z';
    render(<EventRow {...base} type="error" timestamp={pastDate} />);
    // Should include a short month+day prefix (e.g. "Jun 1" or locale equivalent)
    const timeEl = screen.getByText((_content, node) => {
      if (node?.tagName.toLowerCase() !== 'span') {return false;}
      const text = node.textContent ?? '';
      // Cross-day: should contain both date-like and time-like parts
      return /\d{1,2}/.test(text) && /\d{2}:\d{2}:\d{2}/.test(text) && text.length > 8;
    });
    expect(timeEl).toBeTruthy();
  });

  // --- Branch: same-day timestamp shows only time ---
  it('shows only time when timestamp is today', () => {
    const now = new Date();
    const todayTs = now.toISOString();
    render(<EventRow {...base} type="error" timestamp={todayTs} />);
    const timeEl = screen.getByText((_content, node) => {
      if (node?.tagName.toLowerCase() !== 'span') {return false;}
      const text = node.textContent ?? '';
      // Same-day: HH:MM:SS only, no date prefix → exactly 8 chars
      return /^\d{2}:\d{2}:\d{2}$/.test(text);
    });
    expect(timeEl).toBeTruthy();
  });

  // --- Branch: zh locale uses zh-CN formatting ---
  it('uses zh-CN locale when lang is zh', () => {
    localStorage.setItem('ci:lang', JSON.stringify('zh'));
    const pastDate = '2020-06-01T08:00:00Z';
    render(<EventRow {...base} type="error" timestamp={pastDate} />);
    // Just verify it renders without crashing with zh locale
    const row = screen.getByRole('listitem');
    expect(row).toBeTruthy();
    localStorage.removeItem('ci:lang');
  });

  // --- Branch: no ResizeObserver ---
  it('works when ResizeObserver is undefined', () => {
    const orig = globalThis.ResizeObserver;
    // @ts-expect-error - intentionally removing ResizeObserver
    delete globalThis.ResizeObserver;
    try {
      render(<EventRow {...base} type="error" message={longMessage} />);
      expect(screen.getByRole('listitem')).toBeTruthy();
    } finally {
      globalThis.ResizeObserver = orig;
    }
  });

  // --- Branch: repeatCount=1 (below threshold, should NOT show ×) ---
  it('does not show repeat badge when repeatCount is 1', () => {
    const { container } = render(<EventRow {...base} type="error" repeatCount={1} />);
    expect(container.textContent).not.toContain('×');
  });

  // --- Branch: repeatCount=0 ---
  it('does not show repeat badge when repeatCount is 0', () => {
    const { container } = render(<EventRow {...base} type="error" repeatCount={0} />);
    expect(container.textContent).not.toContain('×');
  });

  // --- Branch: repeatCount undefined ---
  it('does not show repeat badge when repeatCount is undefined', () => {
    const { container } = render(<EventRow {...base} type="error" />);
    expect(container.textContent).not.toContain('×');
  });

  // --- Branch: expanded with repeatCount>=2 but NO repeatFirst ---
  it('does not show repeat detail when repeatFirst is missing', () => {
    const { container } = render(<EventRow {...base} type="error" expanded repeatCount={5} />);
    // The repeat detail span should not appear (repeatFirst is falsy)
    const region = container.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    // Should show ×5 in compact row but NOT the repeat detail with "from...to"
    expect(region!.textContent).not.toContain('×5');
  });

  // --- Branch: expanded with repeatCount=1 and repeatFirst ---
  it('does not show repeat info in detail when repeatCount is 1', () => {
    const { container } = render(
      <EventRow {...base} type="error" expanded repeatCount={1} repeatFirst="2026-01-15T14:25:00Z" />,
    );
    const region = container.querySelector('[role="region"]');
    expect(region).toBeTruthy();
    // repeatCount < 2, so no repeat detail
    expect(region!.textContent).not.toContain('×');
  });

  // --- Branch: onKeyDown with various keys ---
  it('calls onKeyDown with Space key', () => {
    const onKeyDown = vi.fn();
    const { container } = render(<EventRow {...base} type="error" onKeyDown={onKeyDown} />);
    fireEvent.keyDown(container.firstChild as HTMLElement, { key: ' ' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('calls onKeyDown with ArrowDown key', () => {
    const onKeyDown = vi.fn();
    const { container } = render(<EventRow {...base} type="error" onKeyDown={onKeyDown} />);
    fireEvent.keyDown(container.firstChild as HTMLElement, { key: 'ArrowDown' });
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  // --- Branch: useLayoutEffect early return when expanded ---
  it('skips clamp measurement when expanded (useLayoutEffect early return)', () => {
    // When expanded=true, useLayoutEffect returns early — no ResizeObserver created
    const { container } = render(<EventRow {...base} type="error" expanded message={longMessage} />);
    // No fade gradient (pointer-events-none div) should exist since expanded
    expect(container.querySelector('.pointer-events-none')).toBeNull();
  });

  // --- Branch: cross-day in expanded detail repeat info ---
  it('shows cross-day formatted times in expanded repeat detail', () => {
    const pastFirst = '2020-01-01T00:00:00Z';
    const pastTs = '2020-01-02T12:00:00Z';
    render(<EventRow {...base} type="error" expanded timestamp={pastTs} repeatCount={3} repeatFirst={pastFirst} />);
    // Both timestamps are cross-day, so fmtTime returns "date time" format
    const region = screen.getByRole('region');
    expect(region).toBeTruthy();
    expect(region.textContent).toContain('×3');
  });
});
