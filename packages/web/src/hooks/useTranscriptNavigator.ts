import { useCallback, useEffect, useRef, useState } from 'react';

export interface JumpRequest {
  index: number;
  key: number;
}

export interface UseTranscriptNavigatorOptions {
  loadedCount: number;
  hasPreviousPage: boolean;
  isLoadingOlder: boolean;
  isFetching: boolean;
  loadOlder: () => void;
}

export interface UseTranscriptNavigatorResult {
  jumpRequest: JumpRequest | undefined;
  visibleIndex: number | undefined;
  setVisibleIndex: (index: number | undefined) => void;
  jumpToIndex: (index: number) => void;
  jumpToStart: () => void;
  jumpToEnd: () => void;
  isLoadingToStart: boolean;
}

/** Bail out if loadedCount doesn't increase for this many idle cycles. */
const MAX_NO_PROGRESS_CYCLES = 5;

function lastLoadedIndex(loadedCount: number): number {
  return Math.max(loadedCount - 1, 0);
}

export function useTranscriptNavigator(options: UseTranscriptNavigatorOptions): UseTranscriptNavigatorResult {
  const { loadedCount, hasPreviousPage, isLoadingOlder, isFetching, loadOlder } = options;

  const [jumpRequest, setJumpRequest] = useState<JumpRequest | undefined>(undefined);
  const [visibleIndex, setVisibleIndex] = useState<number | undefined>(undefined);
  const [isLoadingToStart, setIsLoadingToStart] = useState(false);

  const jumpKeyRef = useRef(0);
  const pendingJumpToStartRef = useRef(false);
  const lastLoadedCountRef = useRef(0);
  const noProgressCyclesRef = useRef(0);

  const resetJumpToStartState = useCallback(() => {
    pendingJumpToStartRef.current = false;
    noProgressCyclesRef.current = 0;
    lastLoadedCountRef.current = 0;
    setIsLoadingToStart(false);
  }, []);

  const jumpToIndex = useCallback(
    (index: number) => {
      resetJumpToStartState();
      jumpKeyRef.current += 1;
      setJumpRequest({ index, key: jumpKeyRef.current });
      setVisibleIndex(index);
    },
    [resetJumpToStartState],
  );

  const jumpToStart = useCallback(() => {
    if (pendingJumpToStartRef.current || isLoadingToStart) {
      return;
    }

    if (!hasPreviousPage) {
      jumpToIndex(0);
      return;
    }

    pendingJumpToStartRef.current = true;
    lastLoadedCountRef.current = loadedCount;
    noProgressCyclesRef.current = 0;
    setIsLoadingToStart(true);

    if (!isFetching) {
      loadOlder();
    }
  }, [hasPreviousPage, isFetching, isLoadingToStart, jumpToIndex, loadOlder, loadedCount]);

  const jumpToEnd = useCallback(() => {
    jumpToIndex(lastLoadedIndex(loadedCount));
  }, [jumpToIndex, loadedCount]);

  useEffect(() => {
    if (!pendingJumpToStartRef.current) {
      return;
    }

    if (!hasPreviousPage) {
      pendingJumpToStartRef.current = false;
      noProgressCyclesRef.current = 0;
      lastLoadedCountRef.current = 0;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Terminal transition when oldest page is fully loaded.
      jumpToIndex(0);
      return;
    }

    if (loadedCount > lastLoadedCountRef.current) {
      lastLoadedCountRef.current = loadedCount;
      noProgressCyclesRef.current = 0;
    } else if (!isLoadingOlder && !isFetching) {
      noProgressCyclesRef.current += 1;
    }

    if (noProgressCyclesRef.current >= MAX_NO_PROGRESS_CYCLES) {
      pendingJumpToStartRef.current = false;
      noProgressCyclesRef.current = 0;
      lastLoadedCountRef.current = 0;

      jumpToIndex(0);
      return;
    }

    if (!isLoadingOlder && !isFetching) {
      loadOlder();
    }
  }, [hasPreviousPage, isFetching, isLoadingOlder, jumpToIndex, loadOlder, loadedCount]);

  useEffect(
    () => () => {
      pendingJumpToStartRef.current = false;
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
    isLoadingToStart,
  };
}
