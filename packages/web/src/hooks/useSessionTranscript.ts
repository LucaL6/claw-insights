import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type CombinedError, useQuery } from 'urql';

import { SessionTranscriptQuery } from '../graphql/queries';

type TranscriptResult = {
  sessionTranscript?: {
    sessionKey: string;
    displayName: string;
    model: string;
    channel?: string | null;
    kind: string;
    thinkingLevel?: string | null;
    startedAt: string;
    fileSize: number;
    totalTokens: number;
    contextTokens: number;
    durationMs: number;
    isSubAgent: boolean;
    parentDisplayName?: string | null;
    spawnPrompt?: string | null;
    totalMessages: number;
    hasMore: boolean;
    messages: Array<{
      timestamp: string;
      role: string;
      content: string;
      contentTruncated: boolean;
      model?: string | null;
      usage?: {
        input: number;
        output: number;
        cacheRead: number;
        cacheWrite: number;
      } | null;
      toolName?: string | null;
    }>;
  };
};

export interface SessionTranscriptMessage {
  timestamp: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  contentTruncated: boolean;
  model?: string;
  usage?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  toolName?: string;
}

export interface UseSessionTranscriptResult {
  meta: TranscriptResult['sessionTranscript'] | undefined;
  messages: SessionTranscriptMessage[];
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  totalMessages: number;
  error: CombinedError | undefined;
  refresh: () => void;
  loadMore: () => void;
  retry: () => void;
}

interface UseSessionTranscriptOptions {
  sessionKey: string;
  pageSize?: number;
}

const REFRESH_TIMEOUT_MS = 10_000;

type TranscriptPage = NonNullable<TranscriptResult['sessionTranscript']>;

function normalizeRole(role: string): 'user' | 'assistant' | 'tool' {
  if (role === 'user' || role === 'assistant' || role === 'tool') {
    return role;
  }
  return 'assistant';
}

export function useSessionTranscript({
  sessionKey,
  pageSize = 200,
}: UseSessionTranscriptOptions): UseSessionTranscriptResult {
  const [currentOffset, setCurrentOffset] = useState(0);
  const [pages, setPages] = useState<Map<number, TranscriptPage>>(() => new Map());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pendingRefresh, setPendingRefresh] = useState(false);

  const [result, reexecute] = useQuery<TranscriptResult>({
    query: SessionTranscriptQuery,
    variables: { sessionKey, limit: pageSize, offset: currentOffset },
  });

  const transcript = result.data?.sessionTranscript;
  const sawFetchingRef = useRef(false);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sessionKeyRef = useRef(sessionKey);

  const clearRefreshTimeout = useCallback(() => {
    if (refreshTimeoutRef.current !== undefined) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = undefined;
    }
  }, []);

  // Reset local pagination and refresh state when switching sessions in a reused hook instance.
  useEffect(() => {
    if (sessionKeyRef.current === sessionKey) {
      return;
    }

    sessionKeyRef.current = sessionKey;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Session key change is an explicit reset boundary.
    setPages(new Map());
    setCurrentOffset(0);
    setIsRefreshing(false);
    setPendingRefresh(false);
    sawFetchingRef.current = false;
    clearRefreshTimeout();
  }, [clearRefreshTimeout, sessionKey]);

  // Store completed page data from each fetched offset.
  useEffect(() => {
    if (!transcript || result.fetching) {
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- Persisting fetched page snapshots is the hook's synchronization side-effect.
    setPages((previous) => {
      if (previous.get(currentOffset) === transcript) {
        return previous;
      }
      const next = new Map(previous);
      next.set(currentOffset, transcript);
      return next;
    });
  }, [currentOffset, result.fetching, transcript]);

  const messages = useMemo<SessionTranscriptMessage[]>(() => {
    const sorted = [...pages.entries()].sort(([a], [b]) => a - b);
    return sorted.flatMap(([, page]) =>
      page.messages.map((message) => ({
        timestamp: message.timestamp,
        role: normalizeRole(message.role),
        content: message.content,
        contentTruncated: message.contentTruncated,
        model: message.model ?? undefined,
        usage: message.usage
          ? {
              input: message.usage.input,
              output: message.usage.output,
              cacheRead: message.usage.cacheRead,
              cacheWrite: message.usage.cacheWrite,
            }
          : undefined,
        toolName: message.toolName ?? undefined,
      })),
    );
  }, [pages]);

  const refresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }

    setIsRefreshing(true);
    sawFetchingRef.current = false;

    setPendingRefresh(true);

    clearRefreshTimeout();
    refreshTimeoutRef.current = setTimeout(() => {
      setIsRefreshing(false);
      setPendingRefresh(false);
      sawFetchingRef.current = false;
      refreshTimeoutRef.current = undefined;
    }, REFRESH_TIMEOUT_MS);
  }, [clearRefreshTimeout, isRefreshing]);

  // Run network-only reexecute after refresh intent has committed.
  useEffect(() => {
    if (!pendingRefresh) {
      return;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Consumes one-shot refresh intent before dispatching reexecute.
    setPendingRefresh(false);
    reexecute({ requestPolicy: 'network-only' });
  }, [pendingRefresh, reexecute]);

  // Detect refresh completion from fetch lifecycle (observe fetching=true then fetching=false).
  // If fetching=true is never observed, timeout fallback will still prevent permanent loading.
  useEffect(() => {
    if (!isRefreshing) {
      return;
    }

    if (result.fetching) {
      sawFetchingRef.current = true;
      return;
    }

    const hasTerminalError = Boolean(result.error);
    if (!sawFetchingRef.current && !hasTerminalError) {
      return;
    }

    if (transcript) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Persist first page snapshot before ending refresh to avoid empty intermediate state.
      setPages((previous) => {
        if (previous.get(currentOffset) === transcript) {
          return previous;
        }
        const next = new Map(previous);
        next.set(currentOffset, transcript);
        return next;
      });
    }

    setIsRefreshing(false);
    sawFetchingRef.current = false;
    clearRefreshTimeout();
  }, [clearRefreshTimeout, currentOffset, isRefreshing, result.error, result.fetching, transcript]);

  useEffect(() => {
    return () => {
      clearRefreshTimeout();
    };
  }, [clearRefreshTimeout]);

  const loadMore = useCallback(() => {
    if (isRefreshing || result.fetching || !transcript?.hasMore) {
      return;
    }
    setCurrentOffset((previous) => previous + pageSize);
  }, [isRefreshing, pageSize, result.fetching, transcript?.hasMore]);

  const retry = useCallback(() => {
    reexecute({ requestPolicy: 'network-only' });
  }, [reexecute]);

  const totalMessages = transcript?.totalMessages ?? 0;
  const hasMore = transcript ? messages.length < totalMessages : false;

  return {
    meta: transcript,
    messages,
    isInitialLoading: result.fetching && !transcript,
    isRefreshing,
    isLoadingMore: !isRefreshing && currentOffset > 0 && result.fetching,
    hasMore,
    totalMessages,
    error: result.error,
    refresh,
    loadMore,
    retry,
  };
}
