import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useSessionTranscript } from '../useSessionTranscript';

const mockReexecute = vi.fn();
const mockUseQuery = vi.fn();

vi.mock('urql', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

type MockMessage = {
  timestamp: string;
  role: string;
  content: string;
  contentTruncated: boolean;
  model: string | null;
  usage: { input: number; output: number; cacheRead: number; cacheWrite: number } | null;
  toolName: string | null;
};

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
  hasMore: boolean;
  messages: MockMessage[];
};

function makePage(sessionKey: string, content: string, role: string, hasMore: boolean): MockPage {
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
    totalMessages: hasMore ? 2 : 1,
    hasMore,
    messages: [
      {
        timestamp: '2026-03-03T10:00:00Z',
        role,
        content,
        contentTruncated: false,
        model: null,
        usage: null,
        toolName: null,
      },
    ],
  };
}

const page0s1 = makePage('s1', 's1-p0', 'user', true);
const page200s1 = makePage('s1', 's1-p200', 'assistant', false);
const page0s2 = makePage('s2', 's2-p0', 'system', false);

const state = {
  lastVars: { sessionKey: 's1', offset: 0 },
  fetching: false,
  error: undefined as unknown,
  pagesBySession: {
    s1: { 0: page0s1, 200: page200s1 },
    s2: { 0: page0s2 },
  } as Record<string, Record<number, MockPage>>,
};

mockUseQuery.mockImplementation((args: { variables: { sessionKey: string; offset: number } }) => {
  state.lastVars = { sessionKey: args.variables.sessionKey, offset: args.variables.offset };
  const page = state.pagesBySession[args.variables.sessionKey]?.[args.variables.offset];
  return [
    {
      data: page ? { sessionTranscript: page } : undefined,
      fetching: state.fetching,
      error: state.error,
    },
    mockReexecute,
  ];
});

describe('useSessionTranscript', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    state.lastVars = { sessionKey: 's1', offset: 0 };
    state.fetching = false;
    state.error = undefined;
    state.pagesBySession = {
      s1: { 0: page0s1, 200: page200s1 },
      s2: { 0: page0s2 },
    };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('defers reexecute and completes refresh across fetching lifecycle', () => {
    const { result, rerender } = renderHook(({ sessionKey }) => useSessionTranscript({ sessionKey }), {
      initialProps: { sessionKey: 's1' },
    });

    act(() => {
      result.current.loadMore();
    });
    expect(state.lastVars).toEqual({ sessionKey: 's1', offset: 200 });

    act(() => {
      result.current.refresh();
      expect(mockReexecute).not.toHaveBeenCalled();
    });

    expect(mockReexecute).toHaveBeenCalledWith({ requestPolicy: 'network-only' });
    expect(result.current.isRefreshing).toBe(true);

    act(() => {
      result.current.loadMore();
    });
    act(() => {
      rerender({ sessionKey: 's1' });
    });
    expect(state.lastVars.offset).toBe(0);

    state.fetching = true;
    act(() => {
      rerender({ sessionKey: 's1' });
    });
    expect(result.current.isRefreshing).toBe(true);

    state.fetching = false;
    act(() => {
      rerender({ sessionKey: 's1' });
    });
    expect(result.current.isRefreshing).toBe(false);
  });

  it('accumulates messages across pages', () => {
    const { result } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    expect(result.current.messages.map((message) => message.content)).toEqual(['s1-p0']);

    act(() => {
      result.current.loadMore();
    });

    expect(result.current.messages.map((message) => message.content)).toEqual(['s1-p0', 's1-p200']);
  });

  it('falls back from refresh loading with timeout when fetching edge is never observed', () => {
    const { result } = renderHook(() => useSessionTranscript({ sessionKey: 's1' }));

    act(() => {
      result.current.refresh();
    });

    expect(result.current.isRefreshing).toBe(true);

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.isRefreshing).toBe(false);
  });

  it('resets pagination cache when sessionKey changes', () => {
    const { result, rerender } = renderHook(({ sessionKey }) => useSessionTranscript({ sessionKey }), {
      initialProps: { sessionKey: 's1' },
    });

    act(() => {
      result.current.loadMore();
    });
    expect(result.current.messages.map((message) => message.content)).toEqual(['s1-p0', 's1-p200']);

    act(() => {
      rerender({ sessionKey: 's2' });
    });
    act(() => {
      rerender({ sessionKey: 's2' });
    });

    expect(result.current.meta?.displayName).toBe('Session s2');
    expect(result.current.messages.map((message) => message.content)).toEqual(['s2-p0']);
  });

  it('normalizes unknown roles to assistant', () => {
    const { result } = renderHook(() => useSessionTranscript({ sessionKey: 's2' }));
    expect(result.current.messages[0]?.role).toBe('assistant');
  });
});
