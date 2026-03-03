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
  TranscriptTimeline: ({ state, jumpToIndex }: { state: { status: string }; jumpToIndex?: number }) => (
    <div data-testid="timeline">
      {state.status}:{jumpToIndex ?? 'none'}
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
  hasMore: boolean;
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
  hasMore: false,
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

const mockRefresh = vi.fn();
const mockLoadMore = vi.fn();
const mockRetry = vi.fn();

type MockHookState = {
  meta: MockMeta | undefined;
  messages: SessionTranscriptMessage[];
  isInitialLoading: boolean;
  isRefreshing: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  totalMessages: number;
  error: unknown;
  refresh: typeof mockRefresh;
  loadMore: typeof mockLoadMore;
  retry: typeof mockRetry;
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
  const retry = vi.fn();
  mockUseSessionTranscript.mockReturnValue(
    buildState({
      meta: undefined,
      messages: [],
      error: new Error('fail'),
      retry,
    }),
  );
  return retry;
}

function buildState(overrides: Partial<MockHookState> = {}): MockHookState {
  return {
    meta: baseMeta,
    messages: baseMessages,
    isInitialLoading: false,
    isRefreshing: false,
    isLoadingMore: false,
    hasMore: false,
    totalMessages: baseMeta.totalMessages,
    error: undefined,
    refresh: mockRefresh,
    loadMore: mockLoadMore,
    retry: mockRetry,
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
    mockLoadMore.mockReset();
    mockRetry.mockReset();
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
    const refreshButton = container.querySelector<HTMLButtonElement>('.dr-refresh-btn');
    expect(refreshButton).toBeTruthy();
    fireEvent.click(refreshButton!);
    expect(mockRefresh).toHaveBeenCalledTimes(1);
  });

  it('disables refresh button while refresh is in progress', () => {
    mockReady({ isRefreshing: true });
    const { container } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    const refreshButton = container.querySelector<HTMLButtonElement>('.dr-refresh-btn');
    expect(refreshButton).toBeTruthy();
    expect(refreshButton?.disabled).toBe(true);
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

  it('shows loading toast and then replaces with success when refresh settles', () => {
    const hookState = buildState();
    mockUseSessionTranscript.mockImplementation(() => hookState);

    const { rerender } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);

    hookState.isRefreshing = true;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(mockShowToast).toHaveBeenCalledWith(expect.any(String), 'loading');

    hookState.isRefreshing = false;
    rerender(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(mockReplaceToast).toHaveBeenCalledWith(42, expect.any(String), 'success');
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

    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(screen.getByText('27')).toBeDefined();
    expect(screen.getByText('423.0k')).toBeDefined();
    expect(screen.getAllByText('47m').length).toBeGreaterThanOrEqual(1);
  });
});
