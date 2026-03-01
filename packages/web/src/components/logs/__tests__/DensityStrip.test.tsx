import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders as render } from '../../../test/render';
import { DensityStrip } from '../DensityStrip';

afterEach(cleanup);

function makeBucket(
  hour: number,
  count = 0,
  hasError = false,
  hasWarning = false,
  hasRestart = false,
  errorCount = 0,
  warningCount = 0,
  restartCount = 0,
) {
  return {
    hour,
    count,
    hasError,
    hasWarning,
    hasRestart,
    errorCount,
    warningCount,
    restartCount,
    epochStart: 1700000000 + hour * 3600,
  };
}

const emptyData = Array.from({ length: 24 }, (_, i) => makeBucket(i));
const mixedData = emptyData.map((b, i) =>
  i === 5 ? { ...b, count: 10, hasError: true, errorCount: 7, warningCount: 3 } : b,
);

describe('DensityStrip', () => {
  it('renders 24 buckets', () => {
    const { container } = render(<DensityStrip data={emptyData} />);
    const buckets = container.querySelectorAll('.density-bar');
    expect(buckets.length).toBe(24);
  });

  it('renders loading skeleton with 24 placeholders', () => {
    const { container } = render(<DensityStrip data={[]} loading />);
    const placeholders = container.querySelectorAll('.animate-pulse');
    expect(placeholders.length).toBe(24);
  });

  it('shows hour labels', () => {
    const { container } = render(<DensityStrip data={emptyData} />);
    const labels = container.querySelectorAll('.text-fg-dim');
    expect(labels[0].textContent).toBe('00:00');
    expect(labels[1].textContent).toBe('now');
  });

  it('calls onHourClick when a bucket is clicked', () => {
    const onClick = vi.fn();
    const { container } = render(<DensityStrip data={mixedData} onHourClick={onClick} />);
    const buckets = container.querySelectorAll('.density-bar');
    fireEvent.click(buckets[5]);
    expect(onClick).toHaveBeenCalledWith(mixedData[5].epochStart);
  });

  it('applies outline to active hour bucket', () => {
    const { container } = render(<DensityStrip data={mixedData} activeHour={mixedData[5].epochStart} />);
    const buckets = container.querySelectorAll('.density-bar');
    expect((buckets[5] as HTMLElement).style.outline).not.toBe('none');
  });

  it('renders warning bucket color', () => {
    const data = Array.from({ length: 24 }, (_, i) =>
      i === 3 ? makeBucket(i, 5, false, true, false, 0, 5) : makeBucket(i),
    );
    const { container } = render(<DensityStrip data={data} />);
    const buckets = container.querySelectorAll('.density-bar');
    expect((buckets[3] as HTMLElement).style.backgroundColor).toBe('var(--amber)');
  });

  it('renders restart bucket color', () => {
    const data = Array.from({ length: 24 }, (_, i) =>
      i === 2 ? makeBucket(i, 3, false, false, true, 0, 0, 3) : makeBucket(i),
    );
    const { container } = render(<DensityStrip data={data} />);
    const buckets = container.querySelectorAll('.density-bar');
    expect((buckets[2] as HTMLElement).style.backgroundColor).toBe('var(--orange)');
  });

  it('renders normal (non-zero, no flags) bucket color', () => {
    const data = Array.from({ length: 24 }, (_, i) => (i === 1 ? makeBucket(i, 10) : makeBucket(i)));
    const { container } = render(<DensityStrip data={data} />);
    const buckets = container.querySelectorAll('.density-bar');
    expect((buckets[1] as HTMLElement).style.backgroundColor).toBe('var(--text-dim)');
  });

  it('applies correct opacity for different counts', () => {
    const data = [
      makeBucket(0, 0),
      makeBucket(1, 3),
      makeBucket(2, 15),
      makeBucket(3, 25),
      ...Array.from({ length: 20 }, (_, i) => makeBucket(i + 4)),
    ];
    const { container } = render(<DensityStrip data={data} />);
    const buckets = container.querySelectorAll('.density-bar');
    expect((buckets[0] as HTMLElement).style.opacity).toBe('0.2');
    expect((buckets[1] as HTMLElement).style.opacity).toBe('0.4');
    expect((buckets[2] as HTMLElement).style.opacity).toBe('0.7');
    expect((buckets[3] as HTMLElement).style.opacity).toBe('1');
  });

  it('handles click without onHourClick', () => {
    const { container } = render(<DensityStrip data={emptyData} />);
    const buckets = container.querySelectorAll('.density-bar');
    fireEvent.click(buckets[0]);
  });

  it('shows fallback hour label when data is empty', () => {
    const { container } = render(<DensityStrip data={[]} />);
    const labels = container.querySelectorAll('.text-fg-dim');
    expect(labels[0].textContent).toBe('00:00');
  });

  // Tooltip tests
  it('renders tooltip with per-type counts when > 0', () => {
    const data = Array.from({ length: 24 }, (_, i) =>
      i === 5 ? makeBucket(5, 15, true, true, false, 8, 7) : makeBucket(i),
    );
    const { container } = render(<DensityStrip data={data} />);
    const tooltips = container.querySelectorAll('.density-tooltip');
    expect(tooltips.length).toBe(24);

    // The tooltip for bucket 5 should contain error and warning counts
    const tooltip5 = tooltips[5];
    expect(tooltip5.textContent).toContain('05:00');
    expect(tooltip5.textContent).toContain('8 errors');
    expect(tooltip5.textContent).toContain('7 warnings');
    expect(tooltip5.textContent).toContain('15 events');
    // Should NOT contain restart since restartCount is 0
    expect(tooltip5.textContent).not.toContain('restart');
  });

  it('tooltip shows singular form for count of 1', () => {
    const data = Array.from({ length: 24 }, (_, i) =>
      i === 2 ? makeBucket(2, 1, true, false, false, 1) : makeBucket(i),
    );
    const { container } = render(<DensityStrip data={data} />);
    const tooltip = container.querySelectorAll('.density-tooltip')[2];
    expect(tooltip.textContent).toContain('1 error');
    expect(tooltip.textContent).not.toContain('1 errors');
    expect(tooltip.textContent).toContain('1 event');
    expect(tooltip.textContent).not.toContain('1 events');
  });

  // ARIA tests
  it('has correct ARIA label with all types', () => {
    const data = Array.from({ length: 24 }, (_, i) =>
      i === 10 ? makeBucket(10, 20, true, true, true, 5, 8, 7) : makeBucket(i),
    );
    render(<DensityStrip data={data} />);
    const bar = screen.getByLabelText('10:00 – 20 events, 5 errors, 8 warnings, 7 restarts');
    expect(bar).toBeTruthy();
  });

  it('ARIA label omits types with 0 count', () => {
    const data = Array.from({ length: 24 }, (_, i) =>
      i === 3 ? makeBucket(3, 5, true, false, false, 5) : makeBucket(i),
    );
    render(<DensityStrip data={data} />);
    const bar = screen.getByLabelText('03:00 – 5 events, 5 errors');
    expect(bar).toBeTruthy();
    expect(bar.getAttribute('role')).toBe('img');
  });

  it('ARIA label for empty bucket has no type breakdown', () => {
    render(<DensityStrip data={emptyData} />);
    const bar = screen.getByLabelText('00:00 – 0 events');
    expect(bar).toBeTruthy();
  });
});
