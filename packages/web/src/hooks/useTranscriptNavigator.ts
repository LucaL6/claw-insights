import { useCallback, useEffect, useRef, useState } from 'react';

export interface JumpRequest {
  index: number;
  key: number;
}

export interface UseTranscriptNavigatorOptions {
  totalMessages: number;
  loadedCount: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  isFetching: boolean;
  loadMore: () => void;
}

export interface UseTranscriptNavigatorResult {
  jumpRequest: JumpRequest | undefined;
  visibleIndex: number | undefined;
  setVisibleIndex: (index: number | undefined) => void;
  jumpToIndex: (index: number) => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  isLoadingToEnd: boolean;
}

/** Bail out if loadedCount doesn't increase for this many idle cycles. */
const MAX_NO_PROGRESS_CYCLES = 2;

function lastLoadedIndex(loadedCount: number): number {
  return Math.max(loadedCount - 1, 0);
}

export function useTranscriptNavigator(options: UseTranscriptNavigatorOptions): UseTranscriptNavigatorResult {
  const { totalMessages, loadedCount, hasMore, isLoadingMore, isFetching, loadMore } = options;

  const [jumpRequest, setJumpRequest] = useState<JumpRequest | undefined>(undefined);
  const [visibleIndex, setVisibleIndex] = useState<number | undefined>(undefined);
  const [isLoadingToEnd, setIsLoadingToEnd] = useState(false);

  const jumpKeyRef = useRef(0);
  const pendingJumpToEndRef = useRef(false);
  const targetIndexRef = useRef<number | undefined>(undefined);
  const lastLoadedCountRef = useRef(0);
  const noProgressCyclesRef = useRef(0);

  const resetJumpToEndState = useCallback(() => {
    pendingJumpToEndRef.current = false;
    targetIndexRef.current = undefined;
    noProgressCyclesRef.current = 0;
    lastLoadedCountRef.current = 0;
    setIsLoadingToEnd(false);
  }, []);

  const jumpToIndex = useCallback(
    (index: number) => {
      resetJumpToEndState();
      jumpKeyRef.current += 1;
      setJumpRequest({ index, key: jumpKeyRef.current });
      setVisibleIndex(index);
    },
    [resetJumpToEndState],
  );

  const jumpToStart = useCallback(() => {
    jumpToIndex(0);
  }, [jumpToIndex]);

  const jumpToEnd = useCallback(() => {
    if (pendingJumpToEndRef.current || isLoadingToEnd) {
      return;
    }

    const targetIndex = Math.max(totalMessages - 1, 0);
    const currentLastLoaded = lastLoadedIndex(loadedCount);

    if (!hasMore || currentLastLoaded >= targetIndex) {
      jumpToIndex(targetIndex);
      return;
    }

    pendingJumpToEndRef.current = true;
    targetIndexRef.current = targetIndex;
    lastLoadedCountRef.current = loadedCount;
    noProgressCyclesRef.current = 0;
    setIsLoadingToEnd(true);

    if (!isFetching) {
      loadMore();
    }
  }, [hasMore, isFetching, isLoadingToEnd, jumpToIndex, loadMore, loadedCount, totalMessages]);

  useEffect(() => {
    if (!pendingJumpToEndRef.current) {
      return;
    }

    const targetIndex = targetIndexRef.current ?? Math.max(totalMessages - 1, 0);
    const currentLastLoaded = lastLoadedIndex(loadedCount);

    if (currentLastLoaded >= targetIndex) {
      pendingJumpToEndRef.current = false;
      targetIndexRef.current = undefined;
      noProgressCyclesRef.current = 0;
      lastLoadedCountRef.current = 0;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Deterministic terminal transition when frozen jump-to-end target is reached.
      jumpToIndex(targetIndex);
      return;
    }

    if (loadedCount > lastLoadedCountRef.current) {
      lastLoadedCountRef.current = loadedCount;
      noProgressCyclesRef.current = 0;
    } else if (!isLoadingMore && !isFetching) {
      noProgressCyclesRef.current += 1;
    }

    if (noProgressCyclesRef.current >= MAX_NO_PROGRESS_CYCLES) {
      pendingJumpToEndRef.current = false;
      targetIndexRef.current = undefined;
      noProgressCyclesRef.current = 0;
      lastLoadedCountRef.current = 0;

      jumpToIndex(currentLastLoaded);
      return;
    }

    if (!isLoadingMore && !isFetching) {
      loadMore();
    }
  }, [hasMore, isFetching, isLoadingMore, jumpToIndex, loadMore, loadedCount, totalMessages]);

  useEffect(
    () => () => {
      pendingJumpToEndRef.current = false;
      targetIndexRef.current = undefined;
      noProgressCyclesRef.current = 0;
      lastLoadedCountRef.current = 0;
    },
    [],
  );

  return {
    jumpRequest,
    visibleIndex,
    setVisibleIndex,
    jumpToIndex,
    jumpToStart,
    jumpToEnd,
    isLoadingToEnd,
  };
}
