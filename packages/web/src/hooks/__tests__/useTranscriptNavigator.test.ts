import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTranscriptNavigator } from '../useTranscriptNavigator';

describe('useTranscriptNavigator', () => {
  it('jumpToIndex emits jumpRequest and updates visibleIndex', () => {
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        totalMessages: 10,
        loadedCount: 10,
        hasMore: false,
        isLoadingMore: false,
        isFetching: false,
        loadMore: vi.fn(),
      }),
    );

    act(() => {
      result.current.jumpToIndex(4);
    });

    expect(result.current.jumpRequest?.index).toBe(4);
    expect(result.current.visibleIndex).toBe(4);
  });

  it('jumpToStart maps to index 0', () => {
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        totalMessages: 10,
        loadedCount: 10,
        hasMore: false,
        isLoadingMore: false,
        isFetching: false,
        loadMore: vi.fn(),
      }),
    );

    act(() => {
      result.current.jumpToStart();
    });

    expect(result.current.jumpRequest?.index).toBe(0);
    expect(result.current.visibleIndex).toBe(0);
  });

  it('increments jump key for repeated jumps', () => {
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        totalMessages: 10,
        loadedCount: 10,
        hasMore: false,
        isLoadingMore: false,
        isFetching: false,
        loadMore: vi.fn(),
      }),
    );

    act(() => {
      result.current.jumpToIndex(1);
    });
    const firstKey = result.current.jumpRequest?.key;

    act(() => {
      result.current.jumpToIndex(2);
    });

    expect(result.current.jumpRequest?.key).toBeGreaterThan(firstKey ?? 0);
  });

  it('jumpToEnd jumps immediately when hasMore is false', () => {
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        totalMessages: 10,
        loadedCount: 10,
        hasMore: false,
        isLoadingMore: false,
        isFetching: false,
        loadMore: vi.fn(),
      }),
    );

    act(() => {
      result.current.jumpToEnd();
    });

    expect(result.current.jumpRequest?.index).toBe(9);
    expect(result.current.isLoadingToEnd).toBe(false);
  });

  it('jumpToEnd enters loading mode and calls loadMore when hasMore is true', async () => {
    const loadMore = vi.fn();
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        totalMessages: 10,
        loadedCount: 3,
        hasMore: true,
        isLoadingMore: false,
        isFetching: false,
        loadMore,
      }),
    );

    act(() => {
      result.current.jumpToEnd();
    });

    expect(result.current.isLoadingToEnd).toBe(true);
    await waitFor(() => {
      expect(loadMore).toHaveBeenCalled();
    });
  });

  it('waits for fetch to settle before first loadMore call', async () => {
    const loadMore = vi.fn();
    const { result, rerender } = renderHook(
      ({ isFetching }) =>
        useTranscriptNavigator({
          totalMessages: 10,
          loadedCount: 3,
          hasMore: true,
          isLoadingMore: false,
          isFetching,
          loadMore,
        }),
      {
        initialProps: { isFetching: true },
      },
    );

    act(() => {
      result.current.jumpToEnd();
    });

    expect(result.current.isLoadingToEnd).toBe(true);
    expect(loadMore).toHaveBeenCalledTimes(0);

    rerender({ isFetching: false });

    await waitFor(() => {
      expect(loadMore).toHaveBeenCalledTimes(1);
    });
  });

  it('completes jump-to-end against frozen target when total grows', async () => {
    const loadMore = vi.fn();
    const { result, rerender } = renderHook(
      ({ totalMessages, loadedCount, hasMore }) =>
        useTranscriptNavigator({
          totalMessages,
          loadedCount,
          hasMore,
          isLoadingMore: false,
          isFetching: false,
          loadMore,
        }),
      {
        initialProps: { totalMessages: 6, loadedCount: 3, hasMore: true },
      },
    );

    act(() => {
      result.current.jumpToEnd();
    });

    await waitFor(() => {
      expect(loadMore).toHaveBeenCalledTimes(1);
    });

    rerender({ totalMessages: 10, loadedCount: 6, hasMore: true });

    await waitFor(() => {
      expect(result.current.isLoadingToEnd).toBe(false);
      expect(result.current.jumpRequest?.index).toBe(5);
    });
  });

  it('repeated jumpToEnd while loading is ignored', async () => {
    const loadMore = vi.fn();
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        totalMessages: 10,
        loadedCount: 3,
        hasMore: true,
        isLoadingMore: false,
        isFetching: false,
        loadMore,
      }),
    );

    act(() => {
      result.current.jumpToEnd();
      result.current.jumpToEnd();
    });

    await waitFor(() => {
      expect(loadMore).toHaveBeenCalledTimes(1);
    });
  });

  it('stops loading loop on unmount', async () => {
    const loadMore = vi.fn();
    const { result, unmount } = renderHook(() =>
      useTranscriptNavigator({
        totalMessages: 10,
        loadedCount: 3,
        hasMore: true,
        isLoadingMore: false,
        isFetching: false,
        loadMore,
      }),
    );

    act(() => {
      result.current.jumpToEnd();
    });

    await waitFor(() => {
      expect(loadMore).toHaveBeenCalledTimes(1);
    });
    unmount();
    expect(loadMore).toHaveBeenCalledTimes(1);
  });

  it('bails out to current position after no-progress cycles', async () => {
    const loadMore = vi.fn();
    const { result, rerender } = renderHook(
      ({ isLoadingMore }) =>
        useTranscriptNavigator({
          totalMessages: 10,
          loadedCount: 3,
          hasMore: true,
          isLoadingMore,
          isFetching: false,
          loadMore,
        }),
      {
        initialProps: { isLoadingMore: false },
      },
    );

    act(() => {
      result.current.jumpToEnd();
    });

    await waitFor(() => {
      expect(loadMore).toHaveBeenCalledTimes(1);
    });

    // Cycle 1: simulate loading started then finished with no progress
    rerender({ isLoadingMore: true });
    rerender({ isLoadingMore: false });

    await waitFor(() => {
      expect(loadMore).toHaveBeenCalledTimes(2);
    });

    // Cycle 2: another load with no progress → triggers bailout
    rerender({ isLoadingMore: true });
    rerender({ isLoadingMore: false });

    await waitFor(() => {
      expect(result.current.isLoadingToEnd).toBe(false);
      expect(result.current.jumpRequest?.index).toBe(2); // lastLoadedIndex = 3 - 1 = 2
    });
  });

  it('can start a fresh jump-to-end after remount', async () => {
    const loadMore = vi.fn();

    const first = renderHook(() =>
      useTranscriptNavigator({
        totalMessages: 10,
        loadedCount: 3,
        hasMore: true,
        isLoadingMore: false,
        isFetching: false,
        loadMore,
      }),
    );

    act(() => {
      first.result.current.jumpToEnd();
    });

    await waitFor(() => {
      expect(loadMore).toHaveBeenCalledTimes(1);
    });

    first.unmount();

    const second = renderHook(() =>
      useTranscriptNavigator({
        totalMessages: 10,
        loadedCount: 3,
        hasMore: true,
        isLoadingMore: false,
        isFetching: false,
        loadMore,
      }),
    );

    act(() => {
      second.result.current.jumpToEnd();
    });

    await waitFor(() => {
      expect(loadMore).toHaveBeenCalledTimes(2);
    });
  });
});
