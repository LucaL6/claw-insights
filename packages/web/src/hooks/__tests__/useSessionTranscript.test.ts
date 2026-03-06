import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionTranscript } from '../useSessionTranscript';

const mockUseQuery = vi.fn();
const mockReexecute = vi.fn((options?: { requestPolicy?: string }) => {
  if (options?.requestPolicy === 'network-only') {
    state.fetching = true;
  }
});

vi.mock('urql', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

type MockPage = {
  sessionKey: string;
  displayName: string;
  model: string;
  channel: string;
  kind: string;
  thinkingLevel: string | null;
  startedAt: string;
  fileSize: number;
  totalTokens: number;
  contextTokens: number;
  durationMs: number;
  isSubAgent: boolean;
  parentDisplayName: string | null;
  spawnPrompt: string | null;
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
    model: string | null;
    usage: null;
    toolName: string | null;
  }>;
};

function makePage(
  sessionKey: string,
  content: string,
  startCursor: string | null,
  hasPreviousPage: boolean,
  options: { endCursor?: string | null; hasNextPage?: boolean; totalMessages?: number } = {},
): MockPage {
  return {
    sessionKey,
    displayName: `Session ${sessionKey}`,
    model: 'claude-sonnet',
    channel: 'webchat',
    kind: 'main',
    thinkingLevel: null,
    startedAt: '2026-03-03T10:00:00Z',
    fileSize: 100,
    totalTokens: 500,
    contextTokens: 200,
    durationMs: 1000,
    isSubAgent: false,
    parentDisplayName: null,
    spawnPrompt: null,
    totalMessages: options.totalMessages ?? 3,
    pageInfo: {
      startCursor,
      endCursor: options.endCursor !== undefined ? options.endCursor : startCursor,
      hasPreviousPage,
      hasNextPage: options.hasNextPage ?? false,
    },
    messages: [
      {
        timestamp: '2026-03-03T10:00:00Z',
        role: 'user',
        content,
        contentTruncated: false,
        model: null,
        usage: null,
        toolName: null,
      },
    ],
  };
}

const latestS1 = makePage('s1', 'latest-s1', 'c-latest', true, { totalMessages: 3 });
const olderS1 = makePage('s1', 'older-s1', 'c-older', false, { totalMessages: 3 });
const latestS2 = makePage('s2', 'latest-s2', 'c-s2', false);
const latestS3NoTail = makePage('s3', 'latest-s3', null, false, {
  endCursor: null,
  totalMessages: 1,
});
const staleS2ForS1 = makePage('s2', 'stale', 'c-stale', false);

const appendedS1 = makePage('s1', 'appended-s1', 'c-appended', true, {
  totalMessages: 4,
});
const appendedChunk1 = makePage('s1', 'append-1', 'c-append-1', true, {
  endCursor: 'c-append-1',
  hasNextPage: true,
  totalMessages: 5,
});
const appendedChunk2 = makePage('s1', 'append-2', 'c-append-2', true, {
  totalMessages: 5,
});
const appendedMissingEndCursor = makePage('s1', 'append-missing-end', 'c-missing-end', true, {
  endCursor: null,
  hasNextPage: true,
  totalMessages: 5,
});
const noNewAfterLatest = {
  ...latestS1,
  pageInfo: {
    startCursor: null,
    endCursor: null,
    hasPreviousPage: true,
    hasNextPage: false,
  },
  messages: [],
} satisfies MockPage;

const state = {
  lastRequestPolicy: 'cache-first',
  fetching: false,
  before: null as string | null,
  after: null as string | null,
  sessionKey: 's1',
  error: undefined as unknown,
  afterPages: new Map<string, MockPage>(),
};

mockUseQuery.mockImplementation(
  (args: {
    variables: { sessionKey: string; before: string | null; after?: string | null };
    requestPolicy: string;
  }) => {
    state.before = args.variables.before;
    state.after = args.variables.after ?? null;
    state.sessionKey = args.variables.sessionKey;
    state.lastRequestPolicy = args.requestPolicy;

    let page: MockPage | undefined;
    if (state.sessionKey === 's1' && state.after) {
      page = state.afterPages.get(state.after);
    } else if (state.sessionKey === 's1' && state.before === null) {
      page = latestS1;
    } else if (state.sessionKey === 's1' && state.before === 'c-latest') {
      page = olderS1;
    } else if (state.sessionKey === 's2' && state.before === null) {
      page = latestS2;
    } else if (state.sessionKey === 's3' && state.before === null) {
      page = latestS3NoTail;
    }

    return [
      {
        data: page ? { sessionTranscript: page } : undefined,
        fetching: state.fetching,
        error: state.error,
      },
      mockReexecute,
    ];
  },
);

describe('useSessionTranscript', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReexecute.mockClear();
    state.fetching = false;
    state.error = undefined;
    state.after = null;
    state.afterPages.clear();
    latestS1.messages[0]!.content = 'latest-s1';
    latestS3NoTail.messages[0]!.content = 'latest-s3';
    appendedS1.messages[0]!.content = 'appended-s1';
    appendedChunk1.messages[0]!.content = 'append-1';
    appendedChunk2.messages[0]!.content = 'append-2';
    appendedMissingEndCursor.messages[0]!.content = 'append-missing-end';
  });

  it('initial load returns latest page and hasPreviousPage', () => {
    const { result } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    expect(result.current.messages.map((m) => m.content)).toEqual(['latest-s1']);
    expect(result.current.hasPreviousPage).toBe(true);
  });

  it('loadOlder prepends older page', () => {
    const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    act(() => {
      result.current.loadOlder();
    });
    act(() => {
      rerender();
    });

    expect(result.current.messages.map((m) => m.content)).toEqual(['older-s1', 'latest-s1']);
    expect(result.current.hasPreviousPage).toBe(false);
  });

  it('refresh appends incremental messages after current tail cursor', () => {
    const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    act(() => {
      result.current.loadOlder();
    });
    act(() => {
      rerender();
    });
    expect(result.current.messages.map((m) => m.content)).toEqual(['older-s1', 'latest-s1']);

    state.afterPages.set('c-latest', appendedS1);

    act(() => {
      result.current.refresh();
    });

    act(() => {
      rerender();
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.refreshTimedOut).toBe(false);
    expect(result.current.messages.map((m) => m.content)).toEqual(['older-s1', 'latest-s1', 'appended-s1']);
  });

  it('refresh keeps existing messages when no incremental messages are returned', () => {
    const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    state.afterPages.set('c-latest', noNewAfterLatest);

    act(() => {
      result.current.refresh();
    });

    act(() => {
      rerender();
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.messages.map((m) => m.content)).toEqual(['latest-s1']);
  });

  it('refresh follows hasNextPage and appends multiple after pages', () => {
    const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    state.afterPages.set('c-latest', appendedChunk1);
    state.afterPages.set('c-append-1', appendedChunk2);

    act(() => {
      result.current.refresh();
    });

    act(() => {
      rerender();
    });

    act(() => {
      rerender();
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.messages.map((m) => m.content)).toEqual(['latest-s1', 'append-1', 'append-2']);
    expect(result.current.totalMessages).toBe(5);
  });

  it('marks refresh as failed when hasNextPage is true but endCursor is missing', () => {
    const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    state.afterPages.set('c-latest', appendedMissingEndCursor);

    act(() => {
      result.current.refresh();
    });

    act(() => {
      rerender();
    });

    act(() => {
      rerender();
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.refreshTimedOut).toBe(true);
    expect(result.current.messages.map((m) => m.content)).toEqual(['latest-s1', 'append-missing-end']);
  });

  it('clears refresh timeout after successful fallback full refresh', () => {
    vi.useFakeTimers();

    try {
      const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's3' }));

      expect(result.current.messages.map((m) => m.content)).toEqual(['latest-s3']);

      act(() => {
        result.current.refresh();
      });

      act(() => {
        rerender();
      });

      expect(result.current.isRefreshing).toBe(true);

      act(() => {
        state.fetching = false;
        rerender();
      });

      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.refreshTimedOut).toBe(false);

      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      act(() => {
        rerender();
      });

      expect(result.current.refreshTimedOut).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks refresh as timed out when fetch never settles', () => {
    vi.useFakeTimers();

    try {
      const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

      act(() => {
        result.current.refresh();
      });

      act(() => {
        rerender();
      });

      expect(result.current.isRefreshing).toBe(true);
      expect(result.current.refreshTimedOut).toBe(false);

      act(() => {
        vi.advanceTimersByTime(10_000);
      });

      act(() => {
        rerender();
      });

      expect(result.current.isRefreshing).toBe(false);
      expect(result.current.refreshTimedOut).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('session switch resets state', () => {
    const { result, rerender } = renderHook(({ sessionKey }) => useSessionTranscript({ sessionKey }), {
      initialProps: { sessionKey: 's1' },
    });

    act(() => {
      result.current.loadOlder();
    });
    rerender({ sessionKey: 's1' });
    expect(result.current.messages.map((m) => m.content)).toEqual(['older-s1', 'latest-s1']);

    rerender({ sessionKey: 's2' });
    rerender({ sessionKey: 's2' });
    expect(result.current.messages.map((m) => m.content)).toEqual(['latest-s2']);
  });

  it('loadOlder is ignored during refresh', () => {
    const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    act(() => {
      result.current.refresh();
    });

    act(() => {
      rerender();
    });

    act(() => {
      result.current.loadOlder();
    });

    expect(state.before).toBe(null);
  });

  it('dedups same cursor page prepend', () => {
    const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    act(() => {
      result.current.loadOlder();
    });
    rerender();
    expect(result.current.messages.map((m) => m.content)).toEqual(['older-s1', 'latest-s1']);

    act(() => {
      result.current.loadOlder();
    });
    rerender();

    expect(result.current.messages.map((m) => m.content)).toEqual(['older-s1', 'latest-s1']);
  });

  it('refresh accepts silent option and exposes refreshMode', () => {
    const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    expect(result.current.refreshMode).toBeNull();

    act(() => {
      result.current.refresh({ silent: true });
    });
    act(() => {
      rerender();
    });

    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.refreshMode).toBe('auto-silent');
  });

  it('refresh without options sets manual refreshMode', () => {
    const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    act(() => {
      result.current.refresh();
    });
    act(() => {
      rerender();
    });

    expect(result.current.isRefreshing).toBe(true);
    expect(result.current.refreshMode).toBe('manual');
  });

  it('refresh returns false when a refresh is already in progress', () => {
    const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    let firstStarted = false;
    act(() => {
      firstStarted = result.current.refresh({ silent: true });
    });
    expect(firstStarted).toBe(true);

    act(() => {
      rerender();
    });
    expect(result.current.isRefreshing).toBe(true);

    let secondStarted = true;
    act(() => {
      secondStarted = result.current.refresh({ silent: true });
    });
    expect(secondStarted).toBe(false);
  });

  it('resets refreshMode after refresh settles', () => {
    const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));
    state.afterPages.set('c-latest', appendedS1);

    act(() => {
      result.current.refresh({ silent: true });
    });

    act(() => {
      rerender();
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.refreshMode).toBeNull();
  });

  it('discards stale session response', () => {
    mockUseQuery.mockImplementationOnce(() => [
      {
        data: { sessionTranscript: staleS2ForS1 },
        fetching: false,
        error: undefined,
      },
      mockReexecute,
    ]);

    const { result } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));
    expect(result.current.messages.map((m) => m.content)).toEqual([]);
  });
});
