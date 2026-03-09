import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionTranscriptMessage } from '../../../hooks/useSessionTranscript';
import { renderWithProviders } from '../../../test/render';
import { SessionDrawer } from '../SessionDrawer';

const mockUseSessionTranscript = vi.fn();
const mockShowToast = vi.fn<(text: string, type?: 'error' | 'success' | 'loading') => number>(() => 42);
const mockReplaceToast = vi.fn<(id: number, text: string, type?: 'error' | 'success' | 'loading') => void>();
const mockDismissToast = vi.fn<(id: number) => void>();

vi.mock('../../../hooks/useSessionTranscript', () => ({
  useSessionTranscript: (...args: unknown[]) => mockUseSessionTranscript(...args),
}));

vi.mock('../../ui/toast-store', () => ({
  showToast: (text: string, type?: 'error' | 'success' | 'loading') => mockShowToast(text, type),
  replaceToast: (id: number, text: string, type?: 'error' | 'success' | 'loading') => mockReplaceToast(id, text, type),
  dismissToast: (id: number) => mockDismissToast(id),
}));

vi.mock('../TranscriptTimeline', () => ({
  TranscriptTimeline: ({
    state,
    jumpToIndex,
  }: {
    state: { status: string; messages?: unknown[] };
    jumpToIndex?: number;
  }) => (
    <div data-testid="timeline">
      {state.status}:{jumpToIndex ?? 'none'}
      {state.status === 'ready' &&
        state.messages?.map((_, index) => <div key={index} data-msg-index={index} data-testid={`msg-${index}`} />)}
    </div>
  ),
}));

type MockMeta = {
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
  hasPreviousPage: boolean;
  messages: unknown[];
};

const baseMeta: MockMeta = {
  sessionKey: 's1',
  displayName: 'Test Session',
  model: 'claude-sonnet-4-20250514',
  channel: 'webchat',
  kind: 'main',
  thinkingLevel: null,
  startedAt: '2024-01-01T10:00:00Z',
  fileSize: 2048,
  totalTokens: 15000,
  contextTokens: 3200,
  durationMs: 300000,
  isSubAgent: false,
  parentDisplayName: null,
  spawnPrompt: null,
  totalMessages: 3,
  hasPreviousPage: false,
  messages: [],
};

const baseMessages: SessionTranscriptMessage[] = [
  {
    timestamp: '2024-01-01T10:00:00Z',
    role: 'user' as const,
    content: 'Hello',
    contentTruncated: false,
    model: undefined,
    usage: undefined,
    toolName: undefined,
  },
  {
    timestamp: '2024-01-01T10:00:01Z',
    role: 'assistant' as const,
    content: 'Hi there',
    contentTruncated: false,
    model: 'claude-sonnet-4-20250514',
    usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0 },
    toolName: undefined,
  },
];

const mockRefresh = vi.fn(() => true);
const mockLoadOlder = vi.fn();

type MockHookState = {
  meta: MockMeta | undefined;
  messages: SessionTranscriptMessage[];
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isLoadingOlder: boolean;
  isFetching: boolean;
  hasPreviousPage: boolean;
  totalMessages: number;
  error: unknown;
  refreshTimedOut: boolean;
  refreshMode: 'manual' | 'auto-silent' | null;
  refresh: typeof mockRefresh;
  loadOlder: typeof mockLoadOlder;
};

function mockReady(overrides?: Partial<MockHookState>) {
  mockUseSessionTranscript.mockReturnValue({
    ...buildState(),
    ...overrides,
  });
}

function mockLoading() {
  mockUseSessionTranscript.mockReturnValue(
    buildState({
      meta: undefined,
      messages: [],
      isInitialLoading: true,
    }),
  );
}

function mockError() {
  mockUseSessionTranscript.mockReturnValue(
    buildState({
      meta: undefined,
      messages: [],
      error: new Error('fail'),
    }),
  );
}

function buildState(overrides: Partial<MockHookState> = {}): MockHookState {
  return {
    meta: baseMeta,
    messages: baseMessages,
    isInitialLoading: false,
    isRefreshing: false,
    isLoadingOlder: false,
    isFetching: false,
    hasPreviousPage: false,
    totalMessages: baseMeta.totalMessages,
    error: undefined,
    refreshTimedOut: false,
    refreshMode: null,
    refresh: mockRefresh,
    loadOlder: mockLoadOlder,
    ...overrides,
  };
}

describe('SessionDrawer', () => {
  const onClose = vi.fn();

  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRefresh.mockReset();
    mockRefresh.mockReturnValue(true);
    mockLoadOlder.mockReset();
    mockShowToast.mockReset();
    mockShowToast.mockReturnValue(42);
    mockReplaceToast.mockReset();
    mockDismissToast.mockReset();
  });

  it('renders drawer with session name in header', () => {
    mockReady();
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(screen.getByText('Test Session')).toBeDefined();
  });

  it('shows loading state with skeleton while query is fetching', () => {
    mockLoading();
    const { container } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
    const timeline = container.querySelector('[data-testid="timeline"]');
    expect(timeline?.textContent).toContain('loading');
  });

  it('shows error state when query fails', () => {
    mockError();
    const { container } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    const timeline = container.querySelector('[data-testid="timeline"]');
    expect(timeline?.textContent).toContain('error');
  });

  it('calls onClose when Escape key is pressed', () => {
    mockReady();
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    mockReady();
    const { container } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    const backdrop = container.querySelector('.bg-black\\/40');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop!);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows SUB-AGENT badge for sub-agent sessions', () => {
    mockReady({
      meta: {
        ...baseMeta,
        isSubAgent: true,
      },
    });
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(screen.getByText('SUB-AGENT')).toBeDefined();
  });

  it('renders refresh button when transcript is loaded', () => {
    mockReady();
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    const refreshButtons = screen.getAllByRole('button', { name: 'Refresh transcript' });
    expect(refreshButtons.length).toBeGreaterThanOrEqual(1);
  });

  it('calls refresh on refresh click', () => {
    mockReady();
    const { container } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    const initialCalls = mockRefresh.mock.calls.length;
    const refreshButton = container.querySelector<HTMLButtonElement>('.dr-refresh-btn');
    expect(refreshButton).toBeTruthy();
    fireEvent.click(refreshButton!);
    expect(mockRefresh).toHaveBeenCalledTimes(initialCalls + 1);
    expect(mockRefresh).toHaveBeenLastCalledWith();
  });

  it('disables refresh button while refresh is in progress', () => {
    mockReady({ isRefreshing: true });
    const { container } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    const refreshButton = container.querySelector<HTMLButtonElement>('.dr-refresh-btn');
    expect(refreshButton).toBeTruthy();
    expect(refreshButton?.disabled).toBe(true);
  });

  it('keeps existing timeline visible while refresh is in progress', () => {
    mockReady({ isRefreshing: true, isInitialLoading: false, messages: baseMessages });
    const { container } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    const timeline = container.querySelector('[data-testid="timeline"]');
    expect(timeline?.textContent).toContain('ready');
  });

  it('restores jump target using anchor id after refresh when messages shift', async () => {
    const first = {
      timestamp: '2024-01-01T10:00:00Z',
      role: 'user' as const,
      content: 'A',
      contentTruncated: false,
      model: undefined,
      usage: undefined,
      toolName: undefined,
    };
    const second = {
      timestamp: '2024-01-01T10:01:00Z',
      role: 'assistant' as const,
      content: 'B',
      contentTruncated: false,
      model: 'claude-sonnet-4-20250514',
      usage: undefined,
      toolName: undefined,
    };
    const third = {
      timestamp: '2024-01-01T10:02:00Z',
      role: 'assistant' as const,
      content: 'C',
      contentTruncated: false,
      model: 'claude-sonnet-4-20250514',
      usage: undefined,
      toolName: undefined,
    };
    const prepended = {
      timestamp: '2024-01-01T09:59:00Z',
      role: 'assistant' as const,
      content: 'prepended',
      contentTruncated: false,
      model: undefined,
      usage: undefined,
      toolName: undefined,
    };

    const hookState = buildState({
      messages: [first, second, third],
      totalMessages: 3,
      meta: {
        ...baseMeta,
        totalMessages: 3,
      },
    });

    mockUseSessionTranscript.mockImplementation(() => hookState);

    const { container, rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    const scrubberButtons = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).filter((button) =>
      button.className.includes('text-[10px]'),
    );
    expect(scrubberButtons.length).toBeGreaterThanOrEqual(3);
    fireEvent.click(scrubberButtons[1]!);

    hookState.isRefreshing = true;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    hookState.messages = [prepended, first, second, third];
    hookState.totalMessages = 4;
    hookState.meta = {
      ...baseMeta,
      totalMessages: 4,
    };
    hookState.isRefreshing = false;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    await waitFor(() => {
      const timeline = container.querySelector('[data-testid="timeline"]');
      expect(timeline?.textContent).toContain('ready:2');
    });
  });

  it('shows loading toast and then no-new toast when refresh settles without new messages', () => {
    const hookState = buildState();
    mockUseSessionTranscript.mockImplementation(() => hookState);

    const { rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    hookState.isRefreshing = true;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'loading');

    hookState.isRefreshing = false;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(mockReplaceToast).toHaveBeenCalledWith(42, 'No new messages', 'success');
  });

  it('shows success toast when refresh settles with new messages', () => {
    const hookState = buildState();
    mockUseSessionTranscript.mockImplementation(() => hookState);

    const { rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    hookState.isRefreshing = true;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    hookState.messages = [
      ...baseMessages,
      {
        timestamp: '2024-01-01T10:00:02Z',
        role: 'assistant' as const,
        content: 'new message',
        contentTruncated: false,
        model: undefined,
        usage: undefined,
        toolName: undefined,
      },
    ];
    hookState.totalMessages = 4;
    hookState.meta = {
      ...baseMeta,
      totalMessages: 4,
    };
    hookState.isRefreshing = false;

    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    expect(mockReplaceToast).toHaveBeenCalledWith(42, 'Transcript refreshed', 'success');
  });

  it('shows failed toast when refresh times out', () => {
    const hookState = buildState();
    mockUseSessionTranscript.mockImplementation(() => hookState);

    const { rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    hookState.isRefreshing = true;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    hookState.refreshTimedOut = true;
    hookState.isRefreshing = false;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    expect(mockReplaceToast).toHaveBeenCalledWith(42, 'Refresh failed', 'error');
  });

  it('shows failed toast when refresh ends with error', () => {
    const hookState = buildState();
    mockUseSessionTranscript.mockImplementation(() => hookState);

    const { rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    hookState.isRefreshing = true;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    hookState.error = new Error('refresh failed');
    hookState.isRefreshing = false;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    expect(mockReplaceToast).toHaveBeenCalledWith(42, 'Refresh failed', 'error');
  });

  it('triggers silent auto-refresh on mount when initial data is cache-hit', () => {
    mockReady();
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
    expect(mockRefresh).toHaveBeenCalledWith({ silent: true });
  });

  it('skips silent auto-refresh after an initial network-miss load', () => {
    const hookState = buildState({
      meta: undefined,
      messages: [],
      isInitialLoading: true,
      isFetching: true,
      totalMessages: 0,
    });
    mockUseSessionTranscript.mockImplementation(() => hookState);

    const { rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(mockRefresh).toHaveBeenCalledTimes(0);

    hookState.meta = baseMeta;
    hookState.messages = baseMessages;
    hookState.isInitialLoading = false;
    hookState.isFetching = false;
    hookState.totalMessages = baseMeta.totalMessages;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    expect(mockRefresh).toHaveBeenCalledTimes(0);
  });

  it('does not duplicate auto-refresh on same-session rerender', () => {
    mockReady();
    const { rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    // Only the initial mount call
    const silentCalls = mockRefresh.mock.calls.filter(
      (args: unknown[]) => args[0] && (args[0] as { silent?: boolean }).silent,
    );
    expect(silentCalls.length).toBe(1);
  });

  it('triggers auto-refresh again on sessionKey change', () => {
    mockReady();
    const { rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(mockRefresh).toHaveBeenCalledTimes(1);

    rerender(<SessionDrawer sessionKey="s2" onClose={onClose} />);
    const silentCalls = mockRefresh.mock.calls.filter(
      (args: unknown[]) => args[0] && (args[0] as { silent?: boolean }).silent,
    );
    expect(silentCalls.length).toBe(2);
  });

  it('retries silent auto-refresh for new session after previous refresh settles', () => {
    const hookState = buildState({ isRefreshing: true });
    mockUseSessionTranscript.mockImplementation(() => hookState);

    const { rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(mockRefresh).toHaveBeenCalledTimes(0);

    rerender(<SessionDrawer sessionKey="s2" onClose={onClose} />);
    expect(mockRefresh).toHaveBeenCalledTimes(0);

    hookState.isRefreshing = false;
    rerender(<SessionDrawer sessionKey="s2" onClose={onClose} />);

    const silentCalls = mockRefresh.mock.calls.filter(
      (args: unknown[]) => args[0] && (args[0] as { silent?: boolean }).silent,
    );
    expect(silentCalls.length).toBe(1);
  });

  it('does not show toasts for silent auto-refresh', () => {
    const hookState = buildState({ refreshMode: 'auto-silent' });
    mockUseSessionTranscript.mockImplementation(() => hookState);

    const { rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    hookState.isRefreshing = true;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(mockShowToast).not.toHaveBeenCalled();

    hookState.isRefreshing = false;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(mockReplaceToast).not.toHaveBeenCalled();
  });

  it('still shows toasts for manual refresh', () => {
    const hookState = buildState({ refreshMode: 'manual' });
    mockUseSessionTranscript.mockImplementation(() => hookState);

    const { rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    hookState.isRefreshing = true;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'loading');

    hookState.isRefreshing = false;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(mockReplaceToast).toHaveBeenCalled();
  });

  it('uses liveSession tokens/status and displays used context with percent', () => {
    mockReady({
      meta: {
        ...baseMeta,
        totalTokens: 15000,
        contextTokens: 3200,
      },
    });
    renderWithProviders(
      <SessionDrawer
        sessionKey="s1"
        onClose={onClose}
        liveSession={{
          key: 's1',
          displayName: 'Live Name',
          totalTokens: 99000,
          contextTokens: 200000,
          usagePercent: 63,
          status: 'ACTIVE',
        }}
      />,
    );
    // liveSession authority: 99.0k tokens, used context 126.0k (63%), ACTIVE status
    expect(screen.getByText('99.0k')).toBeDefined();
    expect(screen.getByText('126.0k (63%)')).toBeDefined();
    expect(screen.getByText('ACTIVE')).toBeDefined();
  });

  it('keeps token/context stats bound to live session authority when liveSession is absent', () => {
    mockReady({
      meta: {
        ...baseMeta,
        totalTokens: 15000,
        contextTokens: 3200,
      },
    });
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(screen.queryByText('15.0k')).toBeNull();
    expect(screen.queryByText('3.2k')).toBeNull();
    expect(screen.getAllByText('--').length).toBeGreaterThanOrEqual(2);
  });

  it('initializes scrubber at tail on first open with messages', async () => {
    // Start loading (no messages yet)
    const hookState = buildState({
      meta: undefined,
      messages: [],
      isInitialLoading: true,
      totalMessages: 0,
    });
    mockUseSessionTranscript.mockImplementation(() => hookState);

    const { container, rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    // Messages arrive
    hookState.meta = { ...baseMeta, totalMessages: 2 };
    hookState.messages = baseMessages;
    hookState.isInitialLoading = false;
    hookState.totalMessages = 2;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    // Timeline should receive jump to last index (1)
    await waitFor(() => {
      const timeline = container.querySelector('[data-testid="timeline"]');
      expect(timeline?.textContent).toContain('ready:1');
    });
  });

  it('resets scrubber tail init on session key change', async () => {
    const hookState = buildState({
      messages: baseMessages,
      totalMessages: 2,
      meta: { ...baseMeta, totalMessages: 2 },
    });
    mockUseSessionTranscript.mockImplementation(() => hookState);

    const { container, rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    await waitFor(() => {
      const timeline = container.querySelector('[data-testid="timeline"]');
      expect(timeline?.textContent).toContain('ready:1');
    });

    // Switch session with 3 messages
    hookState.meta = { ...baseMeta, sessionKey: 's2', totalMessages: 3 };
    hookState.totalMessages = 3;
    hookState.messages = [
      ...baseMessages,
      {
        timestamp: '2024-01-01T10:00:02Z',
        role: 'assistant' as const,
        content: 'Third',
        contentTruncated: false,
        model: undefined,
        usage: undefined,
        toolName: undefined,
      },
    ];
    rerender(<SessionDrawer sessionKey="s2" onClose={onClose} />);

    await waitFor(() => {
      const timeline = container.querySelector('[data-testid="timeline"]');
      expect(timeline?.textContent).toContain('ready:2');
    });
  });

  it('keeps footer at latest position when scrolled near bottom', async () => {
    const hookState = buildState({
      totalMessages: 3,
      messages: [
        ...baseMessages,
        {
          timestamp: '2024-01-01T10:00:02Z',
          role: 'assistant' as const,
          content: 'Third',
          contentTruncated: false,
          model: undefined,
          usage: undefined,
          toolName: undefined,
        },
      ],
      meta: {
        ...baseMeta,
        totalMessages: 3,
      },
    });
    mockUseSessionTranscript.mockImplementation(() => hookState);

    const rafSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });

    const { container } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    const scrollContainer = container.querySelector<HTMLDivElement>('.drawer-scroll');
    if (!scrollContainer) {
      throw new Error('Expected drawer scroll container');
    }

    Object.defineProperty(scrollContainer, 'scrollTop', { configurable: true, value: 980, writable: true });
    Object.defineProperty(scrollContainer, 'clientHeight', { configurable: true, value: 100, writable: true });
    Object.defineProperty(scrollContainer, 'scrollHeight', { configurable: true, value: 1080, writable: true });
    scrollContainer.getBoundingClientRect = (() => ({
      top: 0,
      bottom: 100,
      left: 0,
      right: 100,
      width: 100,
      height: 100,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    })) as typeof scrollContainer.getBoundingClientRect;

    const rowTops = [-120, 0, 70];
    const rows = Array.from(scrollContainer.querySelectorAll<HTMLElement>('[data-msg-index]'));
    rows.forEach((row, index) => {
      const top = rowTops[index] ?? index * 20;
      row.getBoundingClientRect = (() => ({
        top,
        bottom: top + 20,
        left: 0,
        right: 100,
        width: 100,
        height: 20,
        x: 0,
        y: top,
        toJSON: () => ({}),
      })) as typeof row.getBoundingClientRect;
    });

    fireEvent.scroll(scrollContainer);

    await waitFor(() => {
      expect(screen.getByText('3/3 messages')).toBeDefined();
    });

    rafSpy.mockRestore();
  });

  it('does not render "Spawned by" row (ISS-063)', () => {
    mockReady({
      meta: {
        ...baseMeta,
        isSubAgent: true,
        parentDisplayName: 'main',
      },
    });
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(screen.queryByText('spawned by')).toBeNull();
  });

  it('shows SpawnPromptBox when spawnPrompt is present', () => {
    mockReady({
      meta: {
        ...baseMeta,
        isSubAgent: true,
        spawnPrompt: 'Do something special',
      },
    });
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(screen.getByText('Do something special')).toBeDefined();
  });

  it('has correct aria attributes', () => {
    mockReady();
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    const dialogs = screen.getAllByRole('dialog');
    const mainDialog = dialogs.find((d) => d.getAttribute('aria-modal') === 'true');
    expect(mainDialog).toBeDefined();
    expect(mainDialog!.getAttribute('aria-label')).toBe('Session transcript');
  });

  it('shows stats: turns, tokens, duration', () => {
    mockReady({
      meta: {
        ...baseMeta,
        totalTokens: 423000,
        durationMs: 2820000,
      },
      totalMessages: 27,
    });

    renderWithProviders(
      <SessionDrawer
        sessionKey="s1"
        onClose={onClose}
        liveSession={{
          key: 's1',
          displayName: 'Live Name',
          totalTokens: 423000,
          contextTokens: 3200,
          usagePercent: 50,
          status: 'ACTIVE',
        }}
      />,
    );
    expect(screen.getByText('27')).toBeDefined();
    expect(screen.getByText('423.0k')).toBeDefined();
    expect(screen.getAllByText('47m').length).toBeGreaterThanOrEqual(1);
  });

  it('shows current global message position in footer (defaults to latest)', () => {
    mockReady({
      totalMessages: 3,
      messages: baseMessages,
      meta: {
        ...baseMeta,
        totalMessages: 3,
      },
    });

    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    expect(screen.getByText('3/3 messages')).toBeDefined();
  });

  it('jump-to-start triggers loadOlder when previous pages exist', async () => {
    const hookState = buildState({
      hasPreviousPage: true,
      isLoadingOlder: false,
      isFetching: false,
      totalMessages: 3004,
      meta: {
        ...baseMeta,
        totalMessages: 3004,
      },
      messages: Array.from({ length: 200 }, (_, i) => ({
        timestamp: `2024-01-01T10:${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}Z`,
        role: i % 2 === 0 ? ('user' as const) : ('assistant' as const),
        content: `m${i}`,
        contentTruncated: false,
        model: undefined,
        usage: undefined,
        toolName: undefined,
      })),
    });

    mockUseSessionTranscript.mockImplementation(() => hookState);

    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Jump to first message' }));

    await waitFor(() => {
      expect(mockLoadOlder).toHaveBeenCalledTimes(1);
    });
  });

  it('jump-to-end is local scroll only after reopen', async () => {
    const hookState = buildState({
      hasPreviousPage: true,
      isLoadingOlder: false,
      totalMessages: 6,
      meta: {
        ...baseMeta,
        totalMessages: 6,
      },
      messages: [
        ...baseMessages,
        {
          timestamp: '2024-01-01T10:00:02Z',
          role: 'assistant' as const,
          content: 'm3',
          contentTruncated: false,
          model: undefined,
          usage: undefined,
          toolName: undefined,
        },
      ],
    });

    mockUseSessionTranscript.mockImplementation(() => hookState);

    const first = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Jump to last message' }));

    expect(mockLoadOlder).not.toHaveBeenCalled();

    first.unmount();

    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Jump to last message' }));

    await waitFor(() => {
      expect(mockLoadOlder).toHaveBeenCalledTimes(0);
    });
  });
});
