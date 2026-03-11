import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useTranscriptNavigator } from '../useTranscriptNavigator';

describe('useTranscriptNavigator', () => {
  it('jumpToIndex emits jumpRequest and updates visibleIndex', () => {
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        loadedCount: 10,
        hasPreviousPage: false,
        isLoadingOlder: false,
        isFetching: false,
        loadOlder: vi.fn(),
      }),
    );

    act(() => {
      result.current.jumpToIndex(4);
    });

    expect(result.current.jumpRequest?.index).toBe(4);
    expect(result.current.visibleIndex).toBe(4);
  });

  it('jumpToEnd only does local scroll', () => {
    const loadOlder = vi.fn();
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        loadedCount: 10,
        hasPreviousPage: true,
        isLoadingOlder: false,
        isFetching: false,
        loadOlder,
      }),
    );

    act(() => {
      result.current.jumpToEnd();
    });

    expect(result.current.jumpRequest?.index).toBe(9);
    expect(loadOlder).not.toHaveBeenCalled();
  });

  it('jumpToStart enters loading mode and calls loadOlder', async () => {
    const loadOlder = vi.fn();
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        loadedCount: 3,
        hasPreviousPage: true,
        isLoadingOlder: false,
        isFetching: false,
        loadOlder,
      }),
    );

    act(() => {
      result.current.jumpToStart();
    });

    expect(result.current.isLoadingToStart).toBe(true);
    await waitFor(() => {
      expect(loadOlder).toHaveBeenCalled();
    });
  });

  it('jumpToStart finishes at index 0 after hasPreviousPage becomes false', async () => {
    const loadOlder = vi.fn();
    const { result, rerender } = renderHook(
      ({ loadedCount, hasPreviousPage }) =>
        useTranscriptNavigator({
          loadedCount,
          hasPreviousPage,
          isLoadingOlder: false,
          isFetching: false,
          loadOlder,
        }),
      {
        initialProps: { loadedCount: 3, hasPreviousPage: true },
      },
    );

    act(() => {
      result.current.jumpToStart();
    });

    rerender({ loadedCount: 8, hasPreviousPage: false });

    await waitFor(() => {
      expect(result.current.isLoadingToStart).toBe(false);
      expect(result.current.jumpRequest?.index).toBe(0);
    });
  });

  it('repeated jumpToStart while pending is a no-op', () => {
    const loadOlder = vi.fn();
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        loadedCount: 3,
        hasPreviousPage: true,
        isLoadingOlder: false,
        isFetching: false,
        loadOlder,
      }),
    );

    act(() => {
      result.current.jumpToStart();
    });
    expect(result.current.isLoadingToStart).toBe(true);
    const callsBefore = loadOlder.mock.calls.length;

    // Second call should be ignored
    act(() => {
      result.current.jumpToStart();
    });
    expect(loadOlder.mock.calls.length).toBe(callsBefore);
  });

  it('jumpToStart does not call loadOlder when isFetching is true', () => {
    const loadOlder = vi.fn();
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        loadedCount: 3,
        hasPreviousPage: true,
        isLoadingOlder: false,
        isFetching: true,
        loadOlder,
      }),
    );

    act(() => {
      result.current.jumpToStart();
    });

    expect(result.current.isLoadingToStart).toBe(true);
    expect(loadOlder).not.toHaveBeenCalled();
  });

  it('jumpToStart when hasPreviousPage is false jumps directly to 0', () => {
    const loadOlder = vi.fn();
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        loadedCount: 5,
        hasPreviousPage: false,
        isLoadingOlder: false,
        isFetching: false,
        loadOlder,
      }),
    );

    act(() => {
      result.current.jumpToStart();
    });

    expect(result.current.jumpRequest?.index).toBe(0);
    expect(result.current.isLoadingToStart).toBe(false);
    expect(loadOlder).not.toHaveBeenCalled();
  });

  it('bails out after MAX_NO_PROGRESS_CYCLES (5) idle cycles', async () => {
    const loadOlder = vi.fn();
    // Toggle isFetching to simulate idle cycles: each cycle goes fetching→idle
    // which triggers the effect with new deps each time
    const { result, rerender } = renderHook(
      ({ loadedCount, hasPreviousPage, isLoadingOlder, isFetching }) =>
        useTranscriptNavigator({
          loadedCount,
          hasPreviousPage,
          isLoadingOlder,
          isFetching,
          loadOlder,
        }),
      {
        initialProps: { loadedCount: 3, hasPreviousPage: true, isLoadingOlder: false, isFetching: false },
      },
    );

    act(() => {
      result.current.jumpToStart();
    });
    expect(result.current.isLoadingToStart).toBe(true);

    // Simulate 5 idle cycles by toggling isFetching (true→false counts as one idle check)
    for (let i = 0; i < 5; i++) {
      rerender({ loadedCount: 3, hasPreviousPage: true, isLoadingOlder: false, isFetching: true });
      rerender({ loadedCount: 3, hasPreviousPage: true, isLoadingOlder: false, isFetching: false });
    }

    await waitFor(() => {
      expect(result.current.jumpRequest?.index).toBe(0);
      expect(result.current.isLoadingToStart).toBe(false);
    });
  });

  it('continues loading when loadedCount increases during jumpToStart', () => {
    const loadOlder = vi.fn();
    const { result, rerender } = renderHook(
      ({ loadedCount }) =>
        useTranscriptNavigator({
          loadedCount,
          hasPreviousPage: true,
          isLoadingOlder: false,
          isFetching: false,
          loadOlder,
        }),
      {
        initialProps: { loadedCount: 3 },
      },
    );

    act(() => {
      result.current.jumpToStart();
    });

    // loadedCount increases — progress resets noProgressCycles
    rerender({ loadedCount: 6 });
    expect(result.current.isLoadingToStart).toBe(true);
    expect(loadOlder.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not call loadOlder during effect when isLoadingOlder or isFetching', () => {
    const loadOlder = vi.fn();
    const { result, rerender } = renderHook(
      ({ isLoadingOlder, isFetching }) =>
        useTranscriptNavigator({
          loadedCount: 3,
          hasPreviousPage: true,
          isLoadingOlder,
          isFetching,
          loadOlder,
        }),
      {
        initialProps: { isLoadingOlder: false, isFetching: false },
      },
    );

    act(() => {
      result.current.jumpToStart();
    });
    loadOlder.mockClear();

    // While fetching, effect should not call loadOlder again
    rerender({ isLoadingOlder: false, isFetching: true });
    expect(loadOlder).not.toHaveBeenCalled();

    // While loading older, same
    rerender({ isLoadingOlder: true, isFetching: false });
    expect(loadOlder).not.toHaveBeenCalled();
  });

  it('cleanup effect resets refs on unmount', () => {
    const loadOlder = vi.fn();
    const { result, unmount } = renderHook(() =>
      useTranscriptNavigator({
        loadedCount: 3,
        hasPreviousPage: true,
        isLoadingOlder: false,
        isFetching: false,
        loadOlder,
      }),
    );

    act(() => {
      result.current.jumpToStart();
    });
    expect(result.current.isLoadingToStart).toBe(true);

    // Unmount should not throw
    unmount();
  });

  it('jumpToEnd uses Math.max for loadedCount=0', () => {
    const loadOlder = vi.fn();
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        loadedCount: 0,
        hasPreviousPage: false,
        isLoadingOlder: false,
        isFetching: false,
        loadOlder,
      }),
    );

    act(() => {
      result.current.jumpToEnd();
    });

    expect(result.current.jumpRequest?.index).toBe(0);
  });

  it('setVisibleIndex updates visibleIndex', () => {
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        loadedCount: 10,
        hasPreviousPage: false,
        isLoadingOlder: false,
        isFetching: false,
        loadOlder: vi.fn(),
      }),
    );

    act(() => {
      result.current.setVisibleIndex(7);
    });
    expect(result.current.visibleIndex).toBe(7);

    act(() => {
      result.current.setVisibleIndex(undefined);
    });
    expect(result.current.visibleIndex).toBeUndefined();
  });

  it('jumpToIndex resets pending jumpToStart state', async () => {
    const loadOlder = vi.fn();
    const { result } = renderHook(() =>
      useTranscriptNavigator({
        loadedCount: 3,
        hasPreviousPage: true,
        isLoadingOlder: false,
        isFetching: false,
        loadOlder,
      }),
    );

    act(() => {
      result.current.jumpToStart();
    });
    expect(result.current.isLoadingToStart).toBe(true);

    act(() => {
      result.current.jumpToIndex(2);
    });
    expect(result.current.isLoadingToStart).toBe(false);
    expect(result.current.jumpRequest?.index).toBe(2);
  });
});
