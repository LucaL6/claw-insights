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

type TranscriptPage = NonNullable<TranscriptResult['sessionTranscript']>;

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
  refresh: () => void;
  loadOlder: () => void;
}

interface UseSessionTranscriptOptions {
  sessionKey: string;
  pageSize?: number;
}

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
  const [pages, setPages] = useState<TranscriptPage[]>([]);
  const [beforeCursor, setBeforeCursor] = useState<string | undefined>(undefined);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const sessionKeyRef = useRef(sessionKey);

  const [result] = useQuery<TranscriptResult>({
    query: SessionTranscriptQuery,
    variables: { sessionKey, limit: pageSize, before: beforeCursor ?? null },
    requestPolicy: isRefreshing ? 'network-only' : 'cache-first',
  });

  useEffect(() => {
    if (sessionKeyRef.current === sessionKey) {
      return;
    }

    sessionKeyRef.current = sessionKey;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Session switch is explicit reset boundary.
    setPages([]);
    setBeforeCursor(undefined);
    setIsRefreshing(false);
  }, [sessionKey]);

  const transcript = result.data?.sessionTranscript;

  useEffect(() => {
    if (!transcript || result.fetching || transcript.sessionKey !== sessionKeyRef.current) {
      return;
    }

    if (isRefreshing || beforeCursor === undefined) {
      /* eslint-disable react-hooks/set-state-in-effect -- Page storage is the core synchronization side-effect of this hook. */
      setPages([transcript]);
      setBeforeCursor(undefined);
      setIsRefreshing(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      return;
    }

    setPages((previous) => {
      const startCursor = transcript.pageInfo.startCursor;
      if (startCursor && previous.some((page) => page.pageInfo.startCursor === startCursor)) {
        return previous;
      }
      return [transcript, ...previous];
    });
  }, [beforeCursor, isRefreshing, result.fetching, transcript]);

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

  const refresh = useCallback(() => {
    if (isRefreshing) {
      return;
    }
    setIsRefreshing(true);
    setBeforeCursor(undefined);
  }, [isRefreshing]);

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
    refresh,
    loadOlder,
  };
}
