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
  // --- marker generation boundary cases ---
  it('renders nothing with empty timestamps', () => {
    const { container } = renderScrubber({ timestamps: [], onJump: vi.fn() });
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing with fewer than 2 timestamps', () => {
    const { container } = renderScrubber({ timestamps: ['2025-01-01T09:00:00Z'], onJump: vi.fn() });
    expect(container.firstChild).toBeNull();
  });

  it('renders exactly 2 markers for 2 timestamps', () => {
    renderScrubber({ timestamps: ['2025-01-01T09:00:00Z', '2025-01-01T10:00:00Z'], onJump: vi.fn() });
    const markerButtons = screen.getAllByTitle(/Jump to message #/);
    expect(markerButtons.length).toBe(2);
  });

  it('renders time markers', () => {
    renderScrubber({ timestamps: baseTimestamps, onJump: vi.fn() });
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(4);
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

  // --- all same HH:MM (dedup produces 1 candidate, fallback to start/end) ---
  it('handles all timestamps in same minute', () => {
    const timestamps = Array.from({ length: 5 }, (_, i) => `2025-01-01T09:00:${String(i).padStart(2, '0')}Z`);
    renderScrubber({ timestamps, onJump: vi.fn() });
    const markerButtons = screen.getAllByTitle(/Jump to message #/);
    // Should fall back to start/end pair
    expect(markerButtons.length).toBe(2);
  });

  // --- invalid timestamps ---
  it('handles invalid timestamps gracefully', () => {
    const timestamps = ['invalid', 'also-invalid', 'nope', 'still-no'];
    const { container } = renderScrubber({ timestamps, onJump: vi.fn() });
    // Should still render (labels will be --:--)
    expect(container.textContent).toContain('--:--');
  });

  // --- dedup keeps earliest ---
  it('deduplicates repeated HH:MM labels and keeps earliest index', () => {
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

  // --- jump buttons ---
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

  it('uses totalMessages for end index', () => {
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

  // --- marker click ---
  it('calls onJump with marker index when time marker clicked', () => {
    const onJump = vi.fn();
    renderScrubber({ timestamps: baseTimestamps, onJump });
    const timeMarker = screen.getByTitle('Jump to message #2');
    fireEvent.click(timeMarker);
    expect(onJump).toHaveBeenCalledWith(1);
  });

  // --- nearest marker / active highlight ---
  it('highlights nearest marker to activeIndex', () => {
    renderScrubber({ timestamps: baseTimestamps, onJump: vi.fn(), activeIndex: 1 });
    // The marker at index 1 (09:15) should be active (teal bg)
    const marker = screen.getByTitle('Jump to message #2');
    expect(marker.style.backgroundColor).toContain('var(--dr-teal)');
  });

  it('highlights nearest marker when activeIndex is between markers', () => {
    // timestamps at indices 0,1,2,3,4 → markers likely at 0 and 4 (or more)
    // activeIndex=3 should highlight nearest marker
    renderScrubber({ timestamps: baseTimestamps, onJump: vi.fn(), activeIndex: 3 });
    const markers = screen.getAllByTitle(/Jump to message #/);
    const activeMarkers = markers.filter((m) => m.style.backgroundColor.includes('var(--dr-teal)'));
    expect(activeMarkers.length).toBe(1);
  });

  it('no marker highlighted when activeIndex is undefined', () => {
    renderScrubber({ timestamps: baseTimestamps, onJump: vi.fn() });
    const markers = screen.getAllByTitle(/Jump to message #/);
    const activeMarkers = markers.filter((m) => m.style.backgroundColor.includes('var(--dr-teal)'));
    expect(activeMarkers.length).toBe(0);
  });

  // --- start/end disabled + loading combinations ---
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

  it('shows loading icon and disables start when isLoadingToStart', () => {
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

  it('shows loading icon and disables end when isLoadingToEnd', () => {
    renderScrubber({
      timestamps: baseTimestamps,
      onJump: vi.fn(),
      onJumpToEnd: vi.fn(),
      isLoadingToEnd: true,
    });
    const endButton = screen.getByRole('button', { name: 'Jump to last message' }) as HTMLButtonElement;
    expect(endButton.textContent).toBe('⏳');
    expect(endButton.disabled).toBe(true);
  });

  it('disables both buttons when loading both directions', () => {
    renderScrubber({
      timestamps: baseTimestamps,
      onJump: vi.fn(),
      isLoadingToStart: true,
      isLoadingToEnd: true,
      hasPreviousPage: true,
    });
    const startBtn = screen.getByLabelText('Jump to first message') as HTMLButtonElement;
    const endBtn = screen.getByLabelText('Jump to last message') as HTMLButtonElement;
    expect(startBtn.disabled).toBe(true);
    expect(endBtn.disabled).toBe(true);
    expect(startBtn.textContent).toBe('⏳');
    expect(endBtn.textContent).toBe('⏳');
  });

  it('end button enabled and shows ⏭ when not at end and not loading', () => {
    renderScrubber({
      timestamps: baseTimestamps,
      onJump: vi.fn(),
      activeIndex: 2,
    });
    const endBtn = screen.getByLabelText('Jump to last message') as HTMLButtonElement;
    expect(endBtn.disabled).toBe(false);
    expect(endBtn.textContent).toBe('⏭');
  });

  it('start button enabled and shows ⏮ when not at start and not loading', () => {
    renderScrubber({
      timestamps: baseTimestamps,
      onJump: vi.fn(),
      activeIndex: 2,
    });
    const startBtn = screen.getByLabelText('Jump to first message') as HTMLButtonElement;
    expect(startBtn.disabled).toBe(false);
    expect(startBtn.textContent).toBe('⏮');
  });

  // --- large count for marker generation edge cases ---
  it('generates markers for very large timestamp arrays', () => {
    const timestamps = Array.from({ length: 200 }, (_, i) => {
      const d = new Date(Date.UTC(2025, 0, 1, Math.floor(i / 60), i % 60));
      return d.toISOString();
    });
    renderScrubber({ timestamps, onJump: vi.fn() });
    const markerButtons = screen.getAllByTitle(/Jump to message #/);
    expect(markerButtons.length).toBeGreaterThanOrEqual(4);
    expect(markerButtons.length).toBeLessThanOrEqual(8);
  });

  // --- timestamps with zero time span ---
  it('handles timestamps with identical times but different indices', () => {
    const timestamps = Array.from({ length: 10 }, () => '2025-01-01T09:00:00Z');
    renderScrubber({ timestamps, onJump: vi.fn() });
    const markerButtons = screen.getAllByTitle(/Jump to message #/);
    expect(markerButtons.length).toBe(2); // dedup → 1 candidate → fallback start/end
  });

  // --- findNearestMarker with empty markers (line 276) ---
  it('handles activeIndex with empty timestamps gracefully', () => {
    const { container } = renderScrubber({ timestamps: [], onJump: vi.fn(), activeIndex: 5 });
    expect(container.firstChild).toBeNull();
  });

  // --- single timestamp + activeIndex (line 286 ternary arm 2) ---
  it('handles single timestamp with activeIndex set', () => {
    const { container } = renderScrubber({
      timestamps: ['2025-01-01T09:00:00Z'],
      onJump: vi.fn(),
      activeIndex: 0,
    });
    expect(container.firstChild).toBeNull();
  });

  // --- force backfill path: 3 close unique minutes with high rawCount ---
  // Creates scenario where minGap is large enough to block pickNearestCandidate
  // in both fillByTimeAnchors and fillByMessageAnchors, forcing backfillCandidates
  it('exercises backfill when time/message anchors are blocked by minGap', () => {
    // 3 unique HH:MM at indices 0, 1, 2 then 97 repeats of last minute
    // deduped: 3 candidates (indices 0,1,2). targetCount=3. minGap=floor(99/2*0.5)=24
    // pickNearestCandidate returns undefined (index gaps < minGap), triggering backfill
    const timestamps = [
      '2025-01-01T09:00:00Z', // index 0 → "09:00"
      '2025-01-01T09:01:00Z', // index 1 → "09:01"
      '2025-01-01T09:02:00Z', // index 2 → "09:02"
      ...Array.from({ length: 97 }, () => '2025-01-01T09:02:30Z'), // indices 3-99, same "09:02"
    ];
    const onJump = vi.fn();
    renderScrubber({ timestamps, onJump });
    const markerButtons = screen.getAllByTitle(/Jump to message #/);
    expect(markerButtons.length).toBe(3);

    // Click middle marker to verify it's wired up
    fireEvent.click(markerButtons[1]);
    expect(onJump).toHaveBeenCalledWith(1);
  });

  // --- similar scenario but with 4 close candidates to ensure backfill inner loops ---
  it('exercises backfill with 4 close candidates and large minGap', () => {
    const timestamps = [
      '2025-01-01T09:00:00Z', // index 0
      '2025-01-01T09:01:00Z', // index 1
      '2025-01-01T09:02:00Z', // index 2
      '2025-01-01T09:03:00Z', // index 3
      ...Array.from({ length: 196 }, () => '2025-01-01T09:03:30Z'), // indices 4-199
    ];
    const onJump = vi.fn();
    renderScrubber({ timestamps, onJump });
    const markerButtons = screen.getAllByTitle(/Jump to message #/);
    expect(markerButtons.length).toBe(4);
  });

  // --- force fillByMessageAnchors to actually execute (not short-circuited) ---
  // Need fillByTimeAnchors to leave room so fillByMessageAnchors loop body runs
  it('exercises fillByMessageAnchors when time anchors partially fill', () => {
    // 9 unique minutes, first 3 very close (indices 0,1,2), rest spread out
    // This creates a mix where time anchors fill some but message anchors get a chance
    const timestamps: string[] = [];
    // First 3 minutes at indices 0,1,2
    timestamps.push('2025-01-01T08:00:00Z');
    timestamps.push('2025-01-01T08:01:00Z');
    timestamps.push('2025-01-01T08:02:00Z');
    // Then bulk to push indices far apart
    for (let i = 3; i < 50; i++) {
      timestamps.push('2025-01-01T08:02:30Z');
    }
    // Then more unique minutes at high indices
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(2025, 0, 1, 9, i * 10));
      timestamps.push(d.toISOString());
      // Add repeats to inflate rawCount
      for (let j = 0; j < 9; j++) {
        timestamps.push(d.toISOString());
      }
    }
    renderScrubber({ timestamps, onJump: vi.fn() });
    const markerButtons = screen.getAllByTitle(/Jump to message #/);
    expect(markerButtons.length).toBeGreaterThanOrEqual(4);
    expect(markerButtons.length).toBeLessThanOrEqual(8);
  });
});
