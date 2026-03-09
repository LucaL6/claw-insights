import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type CombinedError, useQuery } from 'urql';

import { SessionTranscriptQuery } from '../graphql/queries';
import { getDashboardSourceSelector } from '../graphql/source-selector';

type TranscriptResult = {
  source?: {
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
      pageInfo: {
        startCursor: string | null;
        endCursor: string | null;
        hasPreviousPage: boolean;
        hasNextPage: boolean;
      };
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
    } | null;
  } | null;
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

type TranscriptPage = NonNullable<NonNullable<TranscriptResult['source']>['sessionTranscript']>;

/** Tracks the origin of the active refresh cycle. */
export type RefreshMode = 'manual' | 'auto-silent' | null;

/** Refresh options for transcript fetches. */
export interface RefreshOptions {
  silent?: boolean;
}

export interface UseSessionTranscriptResult {
  meta: TranscriptPage | undefined;
  messages: SessionTranscriptMessage[];
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isLoadingOlder: boolean;
  isFetching: boolean;
  hasPreviousPage: boolean;
  totalMessages: number;
  error: CombinedError | undefined;
  refreshTimedOut: boolean;
  refreshMode: RefreshMode;
  refresh: (options?: RefreshOptions) => boolean;
  loadOlder: () => void;
}

interface UseSessionTranscriptOptions {
  sessionKey: string;
  pageSize?: number;
}

const REFRESH_TIMEOUT_MS = 10_000;

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
  const selector = getDashboardSourceSelector();
  const [pages, setPages] = useState<TranscriptPage[]>([]);
  const [beforeCursor, setBeforeCursor] = useState<string | undefined>(undefined);
  const [afterCursor, setAfterCursor] = useState<string | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshTimedOut, setRefreshTimedOut] = useState(false);
  const [refreshMode, setRefreshMode] = useState<RefreshMode>(null);

  const sessionKeyRef = useRef(sessionKey);
  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const clearRefreshTimeout = useCallback(() => {
    if (refreshTimeoutRef.current !== undefined) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = undefined;
    }
  }, []);

  const [result, reexecute] = useQuery<TranscriptResult>({
    query: SessionTranscriptQuery,
    variables: {
      selector,
      sessionKey,
      limit: pageSize,
      before: afterCursor !== undefined ? null : (beforeCursor ?? null),
      after: afterCursor ?? null,
    },
    requestPolicy: isRefreshing ? 'network-only' : 'cache-first',
  });

  useEffect(() => {
    if (sessionKeyRef.current === sessionKey) {
      return;
    }

    sessionKeyRef.current = sessionKey;
    clearRefreshTimeout();
    /* eslint-disable react-hooks/set-state-in-effect -- Session switch is explicit reset boundary. */
    setPages([]);
    setBeforeCursor(undefined);
    setAfterCursor(undefined);
    setIsRefreshing(false);
    setRefreshTimedOut(false);
    setRefreshMode(null);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [clearRefreshTimeout, sessionKey]);

  const transcript = result.data?.source?.sessionTranscript ?? undefined;

  useEffect(() => {
    if (!transcript || result.fetching || transcript.sessionKey !== sessionKeyRef.current) {
      return;
    }

    if (isRefreshing && afterCursor !== undefined) {
      if (transcript.messages.length > 0) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Synchronizes local page store with fetched transcript page.
        setPages((previous) => {
          const startCursor = transcript.pageInfo.startCursor;
          if (startCursor && previous.some((page) => page.pageInfo.startCursor === startCursor)) {
            return previous;
          }
          return [...previous, transcript];
        });
      }

      const hasNextAfterPage = transcript.pageInfo.hasNextPage;
      const nextAfterCursor = hasNextAfterPage ? (transcript.pageInfo.endCursor ?? undefined) : undefined;
      if (hasNextAfterPage && !nextAfterCursor) {
        // Defensive failure path: inconsistent pagination metadata should not be treated as a successful refresh.
        clearRefreshTimeout();
        setAfterCursor(undefined);
        setRefreshTimedOut(true);
        setRefreshMode(null);
        setIsRefreshing(false);
        return;
      }

      if (nextAfterCursor && nextAfterCursor !== afterCursor) {
        setAfterCursor(nextAfterCursor);
        return;
      }

      clearRefreshTimeout();
      setRefreshTimedOut(false);
      setAfterCursor(undefined);
      setRefreshMode(null);
      setIsRefreshing(false);
      return;
    }

    if (beforeCursor === undefined) {
      if (isRefreshing) {
        // Fallback full refresh path when no tail cursor exists yet.
        clearRefreshTimeout();
        setPages([transcript]);
        setRefreshTimedOut(false);
        setAfterCursor(undefined);
        setRefreshMode(null);
        setIsRefreshing(false);
        return;
      }

      if (pages.length === 0) {
        setPages([transcript]);
      }
      return;
    }

    setPages((previous) => {
      const startCursor = transcript.pageInfo.startCursor;
      if (startCursor && previous.some((page) => page.pageInfo.startCursor === startCursor)) {
        return previous;
      }
      return [transcript, ...previous];
    });
  }, [afterCursor, beforeCursor, clearRefreshTimeout, isRefreshing, pages.length, result.fetching, transcript]);

  const messages = useMemo<SessionTranscriptMessage[]>(() => {
    return pages.flatMap((page) =>
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

  const loadOlder = useCallback(() => {
    if (isRefreshing || result.fetching || pages.length === 0) {
      return;
    }
    const startCursor = pages[0]?.pageInfo.startCursor ?? undefined;
    if (!startCursor) {
      return;
    }
    setBeforeCursor(startCursor);
  }, [isRefreshing, pages, result.fetching]);

  useEffect(() => {
    if (!isRefreshing || result.fetching || !result.error) {
      return;
    }

    clearRefreshTimeout();
    /* eslint-disable react-hooks/set-state-in-effect -- Refresh error finalization. */
    setAfterCursor(undefined);
    setRefreshMode(null);
    setIsRefreshing(false);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [clearRefreshTimeout, isRefreshing, result.error, result.fetching]);

  useEffect(() => {
    return () => {
      clearRefreshTimeout();
    };
  }, [clearRefreshTimeout]);

  const refresh = useCallback(
    (options?: RefreshOptions) => {
      if (isRefreshing) {
        return false;
      }

      const tailCursor = pages.length === 0 ? undefined : (pages[pages.length - 1]?.pageInfo.endCursor ?? undefined);

      setIsRefreshing(true);
      setRefreshTimedOut(false);
      setRefreshMode(options?.silent ? 'auto-silent' : 'manual');

      if (tailCursor) {
        setAfterCursor(tailCursor);
      } else {
        setAfterCursor(undefined);
        setBeforeCursor(undefined);
        reexecute({ requestPolicy: 'network-only' });
      }

      clearRefreshTimeout();
      refreshTimeoutRef.current = setTimeout(() => {
        setRefreshTimedOut(true);
        setAfterCursor(undefined);
        setRefreshMode(null);
        setIsRefreshing(false);
        refreshTimeoutRef.current = undefined;
      }, REFRESH_TIMEOUT_MS);

      return true;
    },
    [clearRefreshTimeout, isRefreshing, pages, reexecute],
  );

  const lastPage = pages.length > 0 ? pages[pages.length - 1] : undefined;
  const meta = lastPage ?? transcript;
  const hasPrevious = pages.length > 0 ? pages[0].pageInfo.hasPreviousPage : false;
  const total = meta?.totalMessages ?? 0;

  return {
    meta,
    messages,
    isInitialLoading: result.fetching && pages.length === 0,
    isRefreshing,
    isLoadingOlder: !isRefreshing && beforeCursor !== undefined && result.fetching,
    isFetching: result.fetching,
    hasPreviousPage: hasPrevious,
    totalMessages: total,
    error: result.error,
    refreshTimedOut,
    refreshMode,
    refresh,
    loadOlder,
  };
}
