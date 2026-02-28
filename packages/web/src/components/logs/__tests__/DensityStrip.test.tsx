import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DensityStrip } from '../DensityStrip';

afterEach(cleanup);

function makeBucket(hour: number, count = 0, hasError = false, hasWarning = false, hasRestart = false) {
  return { hour, count, hasError, hasWarning, hasRestart, epochStart: 1700000000 + hour * 3600 };
}

const emptyData = Array.from({ length: 24 }, (_, i) => makeBucket(i));
const mixedData = emptyData.map((b, i) => (i === 5 ? { ...b, count: 10, hasError: true } : b));

describe('DensityStrip', () => {
  it('renders 24 buckets', () => {
    const { container } = render(<DensityStrip data={emptyData} />);
    const buckets = container.querySelectorAll('.rounded-sm');
    expect(buckets.length).toBe(24);
  });

  it('renders loading skeleton with 24 placeholders', () => {
    const { container } = render(<DensityStrip data={[]} loading />);
    const placeholders = container.querySelectorAll('.animate-pulse');
    expect(placeholders.length).toBe(24);
  });

  it('shows hour labels', () => {
    render(<DensityStrip data={emptyData} />);
    expect(screen.getByText('00:00')).toBeTruthy();
    expect(screen.getByText('now')).toBeTruthy();
  });

  it('calls onHourClick when a bucket is clicked', () => {
    const onClick = vi.fn();
    const { container } = render(<DensityStrip data={mixedData} onHourClick={onClick} />);
    const buckets = container.querySelectorAll('.rounded-sm.cursor-pointer');
    fireEvent.click(buckets[5]);
    expect(onClick).toHaveBeenCalledWith(mixedData[5].epochStart);
  });

  it('applies outline to active hour bucket', () => {
    const { container } = render(<DensityStrip data={mixedData} activeHour={mixedData[5].epochStart} />);
    const buckets = container.querySelectorAll('.rounded-sm');
    expect((buckets[5] as HTMLElement).style.outline).not.toBe('none');
  });

  it('renders warning bucket color', () => {
    const data = Array.from({ length: 24 }, (_, i) => (i === 3 ? makeBucket(i, 5, false, true) : makeBucket(i)));
    const { container } = render(<DensityStrip data={data} />);
    const buckets = container.querySelectorAll('.rounded-sm.cursor-pointer');
    expect((buckets[3] as HTMLElement).style.backgroundColor).toBe('var(--amber)');
  });

  it('renders restart bucket color', () => {
    const data = Array.from({ length: 24 }, (_, i) => (i === 2 ? makeBucket(i, 3, false, false, true) : makeBucket(i)));
    const { container } = render(<DensityStrip data={data} />);
    const buckets = container.querySelectorAll('.rounded-sm.cursor-pointer');
    expect((buckets[2] as HTMLElement).style.backgroundColor).toBe('var(--orange)');
  });

  it('renders normal (non-zero, no flags) bucket color', () => {
    const data = Array.from({ length: 24 }, (_, i) => (i === 1 ? makeBucket(i, 10) : makeBucket(i)));
    const { container } = render(<DensityStrip data={data} />);
    const buckets = container.querySelectorAll('.rounded-sm.cursor-pointer');
    expect((buckets[1] as HTMLElement).style.backgroundColor).toBe('var(--text-dim)');
  });

  it('applies correct opacity for different counts', () => {
    const data = [
      makeBucket(0, 0), // 0.2
      makeBucket(1, 3), // 0.4
      makeBucket(2, 15), // 0.7
      makeBucket(3, 25), // 1
      ...Array.from({ length: 20 }, (_, i) => makeBucket(i + 4)),
    ];
    const { container } = render(<DensityStrip data={data} />);
    const buckets = container.querySelectorAll('.rounded-sm.cursor-pointer');
    expect((buckets[0] as HTMLElement).style.opacity).toBe('0.2');
    expect((buckets[1] as HTMLElement).style.opacity).toBe('0.4');
    expect((buckets[2] as HTMLElement).style.opacity).toBe('0.7');
    expect((buckets[3] as HTMLElement).style.opacity).toBe('1');
  });

  it('handles click without onHourClick', () => {
    const { container } = render(<DensityStrip data={emptyData} />);
    const buckets = container.querySelectorAll('.rounded-sm.cursor-pointer');
    // Should not throw
    fireEvent.click(buckets[0]);
  });

  it('shows fallback hour label when data is empty', () => {
    render(<DensityStrip data={[]} />);
    expect(screen.getByText('00:00')).toBeTruthy();
  });
});
