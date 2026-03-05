import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionTranscript } from '../useSessionTranscript';

const mockUseQuery = vi.fn();

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

function makePage(sessionKey: string, content: string, startCursor: string | null, hasPreviousPage: boolean): MockPage {
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
    totalMessages: 3,
    pageInfo: {
      startCursor,
      endCursor: startCursor,
      hasPreviousPage,
      hasNextPage: false,
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

const latestS1 = makePage('s1', 'latest-s1', 'c-latest', true);
const olderS1 = makePage('s1', 'older-s1', 'c-older', false);
const latestS2 = makePage('s2', 'latest-s2', 'c-s2', false);
const staleS2ForS1 = makePage('s2', 'stale', 'c-stale', false);

const state = {
  lastRequestPolicy: 'cache-first',
  fetching: false,
  before: null as string | null,
  sessionKey: 's1',
};

mockUseQuery.mockImplementation(
  (args: { variables: { sessionKey: string; before: string | null }; requestPolicy: string }) => {
    state.before = args.variables.before;
    state.sessionKey = args.variables.sessionKey;
    state.lastRequestPolicy = args.requestPolicy;

    let page: MockPage | undefined;
    if (state.sessionKey === 's1' && state.before === null) {
      page = latestS1;
    } else if (state.sessionKey === 's1' && state.before === 'c-latest') {
      page = olderS1;
    } else if (state.sessionKey === 's2' && state.before === null) {
      page = latestS2;
    }

    return [
      {
        data: page ? { sessionTranscript: page } : undefined,
        fetching: state.fetching,
        error: undefined,
      },
    ];
  },
);

describe('useSessionTranscript', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.fetching = false;
    latestS1.messages[0]!.content = 'latest-s1';
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

  it('refresh uses network-only and replaces with newest page', () => {
    const { result, rerender } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    act(() => {
      result.current.loadOlder();
    });
    act(() => {
      rerender();
    });
    expect(result.current.messages.map((m) => m.content)).toEqual(['older-s1', 'latest-s1']);

    latestS1.messages[0]!.content = 'latest-s1-refreshed';
    act(() => {
      result.current.refresh();
    });

    expect(result.current.messages.map((m) => m.content)).toEqual(['latest-s1-refreshed']);

    act(() => {
      rerender();
    });

    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.messages.map((m) => m.content)).toEqual(['latest-s1-refreshed']);
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
    const { result } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    act(() => {
      result.current.refresh();
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

  it('discards stale session response', () => {
    mockUseQuery.mockImplementationOnce(() => [
      {
        data: { sessionTranscript: staleS2ForS1 },
        fetching: false,
        error: undefined,
      },
    ]);

    const { result } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));
    expect(result.current.messages.map((m) => m.content)).toEqual([]);
  });
});
