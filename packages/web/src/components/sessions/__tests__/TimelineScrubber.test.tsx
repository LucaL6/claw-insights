import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { I18nProvider } from '../../../i18n/context';
import { TimelineScrubber } from '../TimelineScrubber';

function renderScrubber(props: ComponentProps<typeof TimelineScrubber>) {
  return render(
    <I18nProvider>
      <TimelineScrubber {...props} />
    </I18nProvider>,
  );
}

afterEach(() => {
  cleanup();
});

const baseTimestamps = [
  '2025-01-01T09:00:00Z',
  '2025-01-01T09:15:00Z',
  '2025-01-01T09:30:00Z',
  '2025-01-01T09:45:00Z',
  '2025-01-01T10:00:00Z',
];

describe('TimelineScrubber', () => {
  it('renders nothing with fewer than 2 timestamps', () => {
    const { container } = renderScrubber({ timestamps: ['2025-01-01T09:00:00Z'], onJump: vi.fn() });
    expect(container.firstChild).toBeNull();
  });

  it('renders time markers', () => {
    renderScrubber({ timestamps: baseTimestamps, onJump: vi.fn() });
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
  });

  it('renders jump-to-start and jump-to-end buttons', () => {
    renderScrubber({ timestamps: baseTimestamps, onJump: vi.fn() });
    expect(screen.getByLabelText('Jump to first message')).toBeTruthy();
    expect(screen.getByLabelText('Jump to last message')).toBeTruthy();
  });

  it('calls onJump(0) when start button clicked', () => {
    const onJump = vi.fn();
    renderScrubber({ timestamps: baseTimestamps, onJump, activeIndex: 2 });
    fireEvent.click(screen.getByLabelText('Jump to first message'));
    expect(onJump).toHaveBeenCalledWith(0);
  });

  it('uses onJumpToStart when provided', () => {
    const onJump = vi.fn();
    const onJumpToStart = vi.fn();

    renderScrubber({ timestamps: baseTimestamps, onJump, activeIndex: 2, onJumpToStart, hasPreviousPage: true });

    fireEvent.click(screen.getByRole('button', { name: 'Jump to first message' }));

    expect(onJumpToStart).toHaveBeenCalledTimes(1);
    expect(onJump).not.toHaveBeenCalledWith(0);
  });

  it('calls onJump(last) when end button clicked', () => {
    const onJump = vi.fn();
    renderScrubber({ timestamps: baseTimestamps, onJump, activeIndex: 0 });
    fireEvent.click(screen.getByLabelText('Jump to last message'));
    expect(onJump).toHaveBeenCalledWith(4);
  });

  it('uses totalMessages for end index when provided', () => {
    const onJump = vi.fn();
    renderScrubber({ timestamps: baseTimestamps, onJump, activeIndex: 0, totalMessages: 100 });
    fireEvent.click(screen.getByLabelText('Jump to last message'));
    expect(onJump).toHaveBeenCalledWith(99);
  });

  it('uses onJumpToEnd when provided', () => {
    const onJump = vi.fn();
    const onJumpToEnd = vi.fn();

    renderScrubber({ timestamps: baseTimestamps, onJump, activeIndex: 0, onJumpToEnd });

    fireEvent.click(screen.getByRole('button', { name: 'Jump to last message' }));

    expect(onJumpToEnd).toHaveBeenCalledTimes(1);
    expect(onJump).not.toHaveBeenCalledWith(baseTimestamps.length - 1);
  });

  it('shows loading icon when isLoadingToEnd is true', () => {
    renderScrubber({
      timestamps: baseTimestamps,
      onJump: vi.fn(),
      onJumpToEnd: vi.fn(),
      isLoadingToEnd: true,
    });

    expect(screen.getByText('⏳')).toBeDefined();
  });

  it('shows loading icon when isLoadingToStart is true', () => {
    renderScrubber({
      timestamps: baseTimestamps,
      onJump: vi.fn(),
      onJumpToStart: vi.fn(),
      isLoadingToStart: true,
      hasPreviousPage: true,
    });

    const startButton = screen.getByRole('button', { name: 'Jump to first message' });
    expect(startButton.textContent).toBe('⏳');
    expect((startButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('disables jump-to-end while loading to end', () => {
    renderScrubber({
      timestamps: baseTimestamps,
      onJump: vi.fn(),
      onJumpToEnd: vi.fn(),
      isLoadingToEnd: true,
    });

    const endButton = screen.getByRole('button', { name: 'Jump to last message' }) as HTMLButtonElement;
    expect(endButton.disabled).toBe(true);
  });

  it('disables start button when at index 0 and no older messages', () => {
    renderScrubber({ timestamps: baseTimestamps, onJump: vi.fn(), activeIndex: 0, hasPreviousPage: false });
    const startBtn = screen.getByLabelText('Jump to first message') as HTMLButtonElement;
    expect(startBtn.disabled).toBe(true);
  });

  it('keeps start button enabled at index 0 when older pages exist', () => {
    renderScrubber({ timestamps: baseTimestamps, onJump: vi.fn(), activeIndex: 0, hasPreviousPage: true });
    const startBtn = screen.getByLabelText('Jump to first message') as HTMLButtonElement;
    expect(startBtn.disabled).toBe(false);
  });

  it('disables end button when at last index', () => {
    renderScrubber({ timestamps: baseTimestamps, onJump: vi.fn(), activeIndex: 4 });
    const endBtn = screen.getByLabelText('Jump to last message') as HTMLButtonElement;
    expect(endBtn.disabled).toBe(true);
  });

  it('calls onJump with marker index when time marker clicked', () => {
    const onJump = vi.fn();
    renderScrubber({ timestamps: baseTimestamps, onJump });
    const timeMarker = screen.getByTitle('Jump to message #2');
    fireEvent.click(timeMarker);
    expect(onJump).toHaveBeenCalledWith(1);
  });

  it('caps marker count at 8 for long timelines', () => {
    const timestamps = Array.from({ length: 40 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 0, 1, 0, i * 20));
      return d.toISOString();
    });

    renderScrubber({ timestamps, onJump: vi.fn() });

    const markerButtons = screen.getAllByTitle(/Jump to message #/);
    expect(markerButtons.length).toBeLessThanOrEqual(8);
  });

  it('deduplicates repeated HH:MM labels and keeps earliest index in the minute bucket', () => {
    const onJump = vi.fn();
    const timestamps = [
      '2025-01-01T02:04:01Z',
      '2025-01-01T03:00:01Z',
      '2025-01-01T04:49:01Z',
      '2025-01-01T04:49:20Z',
      '2025-01-01T04:50:00Z',
      '2025-01-01T04:50:40Z',
      '2025-01-01T04:54:02Z',
      '2025-01-01T04:54:59Z',
      '2025-01-01T12:30:01Z',
      '2025-01-01T12:30:58Z',
    ];

    renderScrubber({ timestamps, onJump });

    const markerButtons = screen.getAllByTitle(/Jump to message #/);
    const labels = markerButtons.map((button) => button.textContent ?? '');
    expect(new Set(labels).size).toBe(labels.length);

    const minuteMarker = screen.getByTitle('Jump to message #3');
    fireEvent.click(minuteMarker);
    expect(onJump).toHaveBeenLastCalledWith(2);
  });
});
