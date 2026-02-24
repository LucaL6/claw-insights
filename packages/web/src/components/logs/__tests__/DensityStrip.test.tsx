import { cleanup, fireEvent,render, screen } from '@testing-library/react';
import { afterEach,describe, expect, it, vi } from 'vitest';

import { DensityStrip } from '../DensityStrip';

afterEach(cleanup);

function makeBucket(hour: number, count = 0, hasError = false) {
  return { hour, count, hasError, hasWarning: false, hasRestart: false, epochStart: 1700000000 + hour * 3600 };
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
});
