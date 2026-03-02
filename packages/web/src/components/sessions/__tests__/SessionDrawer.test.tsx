import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { SessionDrawer } from '../SessionDrawer';

// Mock urql
const mockUseQuery = vi.fn();
vi.mock('urql', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

// Mock TruncatedContent to just render children
vi.mock('../../ui/TruncatedContent', () => ({
  TruncatedContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock TranscriptTimeline to avoid react-markdown ESM issues in happy-dom
vi.mock('../TranscriptTimeline', () => ({
  TranscriptTimeline: ({ state }: { state: { status: string } }) => <div data-testid="timeline">{state.status}</div>,
}));

const baseMockTranscript = {
  displayName: 'Test Session',
  model: 'claude-sonnet-4-20250514',
  channel: 'webchat',
  thinkingLevel: null,
  isSubAgent: false,
  spawnPrompt: null,
  startedAt: '2024-01-01T10:00:00Z',
  fileSize: 2048,
  totalTokens: 15000,
  durationMs: 300000,
  totalMessages: 3,
  hasMore: false,
  messages: [
    {
      timestamp: '2024-01-01T10:00:00Z',
      role: 'user',
      content: 'Hello',
      contentTruncated: false,
      model: null,
      usage: null,
      toolName: null,
    },
    {
      timestamp: '2024-01-01T10:00:01Z',
      role: 'assistant',
      content: 'Hi there',
      contentTruncated: false,
      model: 'claude-sonnet-4-20250514',
      usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0 },
      toolName: null,
    },
  ],
};

function mockReady(overrides = {}) {
  mockUseQuery.mockReturnValue([
    { data: { sessionTranscript: { ...baseMockTranscript, ...overrides } }, fetching: false, error: undefined },
    vi.fn(),
  ]);
}

function mockLoading() {
  mockUseQuery.mockReturnValue([{ data: undefined, fetching: true, error: undefined }, vi.fn()]);
}

function mockError() {
  const reexecute = vi.fn();
  mockUseQuery.mockReturnValue([{ data: undefined, fetching: false, error: new Error('fail') }, reexecute]);
  return reexecute;
}

describe('SessionDrawer', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders drawer with session name in header', () => {
    mockReady();
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(screen.getByText('Test Session')).toBeDefined();
  });

  it('shows loading state with skeleton while query is fetching', () => {
    mockLoading();
    const { container } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    // Header skeleton should have pulsing elements
    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
    // Timeline shows loading state
    expect(screen.getByText('loading')).toBeDefined();
  });

  it('shows error state when query fails', () => {
    mockError();
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    // TranscriptTimeline is mocked — it renders state.status as text
    expect(screen.getByText('error')).toBeDefined();
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
    mockReady({ isSubAgent: true });
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(screen.getByText('SUB-AGENT')).toBeDefined();
  });

  it('renders refresh button when transcript is loaded', () => {
    mockReady();
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    const refreshBtns = screen.getAllByRole('button', { name: 'Refresh transcript' });
    expect(refreshBtns.length).toBeGreaterThanOrEqual(1);
  });

  it('calls reexecute on refresh click', () => {
    const reexecute = vi.fn();
    mockUseQuery.mockReturnValue([
      { data: { sessionTranscript: { ...baseMockTranscript } }, fetching: false, error: undefined },
      reexecute,
    ]);
    const { container } = renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    const refreshBtn = container.querySelector<HTMLButtonElement>('.dr-refresh-btn');
    expect(refreshBtn).toBeTruthy();
    fireEvent.click(refreshBtn!);
    expect(reexecute).toHaveBeenCalledWith({ requestPolicy: 'network-only' });
  });

  it('does not render "Spawned by" row (ISS-063)', () => {
    mockReady({ isSubAgent: true, parentDisplayName: 'main' });
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    expect(screen.queryByText('spawned by')).toBeNull();
  });

  it('shows SpawnPromptBox when spawnPrompt is present', () => {
    mockReady({ isSubAgent: true, spawnPrompt: 'Do something special' });
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
    mockReady({ totalMessages: 27, totalTokens: 423000, durationMs: 2820000 });
    renderWithProviders(<SessionDrawer sessionKey="s1" onClose={onClose} />);
    // Stats row big numbers
    expect(screen.getByText('27')).toBeDefined();
    expect(screen.getByText('423.0k')).toBeDefined();
    // Duration appears in both meta and stats rows
    expect(screen.getAllByText('47m').length).toBeGreaterThanOrEqual(1);
  });
});
