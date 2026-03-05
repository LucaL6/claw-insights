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
});
