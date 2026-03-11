import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { type TimelineState, TranscriptTimeline } from '../TranscriptTimeline';

vi.mock('../../ui/TruncatedContent', () => ({
  TruncatedContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('react-markdown', () => ({ default: ({ children }: { children: string }) => <span>{children}</span> }));
vi.mock('rehype-highlight', () => ({ default: {} }));

const makeMessage = (
  role: 'user' | 'assistant' | 'tool',
  content: string,
  overrides?: Partial<{
    model: string;
    usage: { input: number; output: number; cacheRead: number; cacheWrite: number };
    toolName: string;
    timestamp: string;
  }>,
) => ({
  timestamp: overrides?.timestamp ?? '2024-01-01T10:00:00Z',
  role,
  content,
  contentTruncated: false,
  model: overrides?.model ?? (role === 'assistant' ? 'claude-sonnet-4-20250514' : undefined),
  usage:
    overrides?.usage ?? (role === 'assistant' ? { input: 100, output: 50, cacheRead: 0, cacheWrite: 0 } : undefined),
  toolName: overrides?.toolName ?? (role === 'tool' ? 'read_file' : undefined),
});

describe('TranscriptTimeline', () => {
  it('renders loading state with skeleton', () => {
    const { container } = renderWithProviders(<TranscriptTimeline state={{ status: 'loading' }} />);
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders empty state message', () => {
    renderWithProviders(<TranscriptTimeline state={{ status: 'empty' }} />);
    expect(screen.getByText('No messages in this session')).toBeDefined();
  });

  // --- errorCode three branches ---
  it('renders error with default message when no errorCode', () => {
    const retry = vi.fn();
    renderWithProviders(<TranscriptTimeline state={{ status: 'error', retry }} />);
    expect(screen.getByText('Failed to load transcript')).toBeDefined();
    screen.getByText('Retry').click();
    expect(retry).toHaveBeenCalled();
  });

  it('renders NOT_AVAILABLE error', () => {
    const retry = vi.fn();
    renderWithProviders(<TranscriptTimeline state={{ status: 'error', errorCode: 'NOT_AVAILABLE', retry }} />);
    expect(screen.getByText('Transcript not available')).toBeDefined();
  });

  it('renders TRANSCRIPT_TOO_LARGE error', () => {
    const retry = vi.fn();
    renderWithProviders(<TranscriptTimeline state={{ status: 'error', errorCode: 'TRANSCRIPT_TOO_LARGE', retry }} />);
    expect(screen.getByText('Transcript too large')).toBeDefined();
  });

  // --- role rendering ---
  it('renders messages with role labels', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [makeMessage('user', 'Hello'), makeMessage('assistant', 'Hi'), makeMessage('tool', 'result')],
      totalMessages: 3,
      hasPreviousPage: false,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getByText('user')).toBeDefined();
    expect(screen.getByText('assistant')).toBeDefined();
    expect(screen.getByText('TOOL')).toBeDefined();
  });

  // --- tool with toolName badge ---
  it('renders tool message with toolName badge', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [makeMessage('tool', 'file contents', { toolName: 'read_file' })],
      totalMessages: 1,
      hasPreviousPage: false,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getAllByText('read_file').length).toBeGreaterThanOrEqual(1);
  });

  // --- assistant usage with cacheRead > 0 ---
  it('renders cache read tokens when cacheRead > 0', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [
        makeMessage('assistant', 'response', {
          usage: { input: 2000, output: 500, cacheRead: 1500, cacheWrite: 0 },
        }),
      ],
      totalMessages: 1,
      hasPreviousPage: false,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getByText(/cache:1\.5k/)).toBeDefined();
  });

  it('does not render cache info when cacheRead is 0', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [
        makeMessage('assistant', 'response', {
          usage: { input: 100, output: 50, cacheRead: 0, cacheWrite: 0 },
        }),
      ],
      totalMessages: 1,
      hasPreviousPage: false,
    };
    const { container } = renderWithProviders(<TranscriptTimeline state={state} />);
    expect(container.textContent).not.toContain('cache:');
  });

  // --- model formatting ---
  it('renders shortened model name for assistant', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [makeMessage('assistant', 'hi', { model: 'anthropic/claude-sonnet-4-20250514' })],
      totalMessages: 1,
      hasPreviousPage: false,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getAllByText('sonnet-4-20250514').length).toBeGreaterThanOrEqual(1);
  });

  // --- load older indicator ---
  it('shows load older indicator when there are previous messages', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [makeMessage('user', 'Hello')],
      totalMessages: 50,
      hasPreviousPage: true,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getByText(/49 more messages/)).toBeDefined();
  });

  it('shows loading text when loadingOlder is true', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [makeMessage('user', 'Hello')],
      totalMessages: 50,
      hasPreviousPage: true,
      loadingOlder: true,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getByText('Loading…')).toBeDefined();
  });

  it('calls onLoadOlder when load older button clicked', () => {
    const onLoadOlder = vi.fn();
    const state: TimelineState = {
      status: 'ready',
      messages: [makeMessage('user', 'Hello')],
      totalMessages: 50,
      hasPreviousPage: true,
    };
    renderWithProviders(<TranscriptTimeline state={state} onLoadOlder={onLoadOlder} />);
    const buttons = screen.getAllByText(/49 more messages/);
    // Click the last rendered button (the one attached to the actual DOM tree)
    fireEvent.click(buttons[buttons.length - 1]);
    expect(onLoadOlder).toHaveBeenCalled();
  });

  // --- plain timeline path (<=50 messages, no scrollRef or no scrollRef) ---
  it('renders plain timeline for small message count', () => {
    const messages = Array.from({ length: 5 }, (_, i) =>
      makeMessage('user', `msg ${i}`, { timestamp: `2024-01-01T10:0${i}:00Z` }),
    );
    const state: TimelineState = {
      status: 'ready',
      messages,
      totalMessages: 5,
      hasPreviousPage: false,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getByText('msg 0')).toBeDefined();
    expect(screen.getByText('msg 4')).toBeDefined();
  });

  it('renders plain timeline even with >50 messages if no scrollRef', () => {
    const messages = Array.from({ length: 55 }, (_, i) =>
      makeMessage('user', `pmsg ${i}`, { timestamp: `2024-01-01T10:${String(i % 60).padStart(2, '0')}:00Z` }),
    );
    const state: TimelineState = {
      status: 'ready',
      messages,
      totalMessages: 55,
      hasPreviousPage: false,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getByText('pmsg 0')).toBeDefined();
  });

  // --- jumpToIndex in plain timeline ---
  it('accepts jumpToIndex and jumpKey props without error', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [makeMessage('user', 'Hello'), makeMessage('assistant', 'Hi')],
      totalMessages: 2,
      hasPreviousPage: false,
    };
    renderWithProviders(<TranscriptTimeline state={state} jumpToIndex={0} jumpKey={1} />);
    expect(screen.getAllByText('Hello').length).toBeGreaterThanOrEqual(1);
  });

  // --- formatTime invalid ---
  it('renders --:--:-- for invalid timestamp', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [makeMessage('user', 'Hello', { timestamp: 'invalid-date' })],
      totalMessages: 1,
      hasPreviousPage: false,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getAllByText('--:--:--').length).toBeGreaterThanOrEqual(1);
  });

  // --- formatModelShort edge cases ---
  it('renders model without slash as-is', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [makeMessage('assistant', 'hi', { model: 'gpt-4' })],
      totalMessages: 1,
      hasPreviousPage: false,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getByText('gpt-4')).toBeDefined();
  });

  // --- formatTokens >= 1000 ---
  it('formats large token counts with k suffix', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [
        makeMessage('assistant', 'hi', {
          usage: { input: 1500, output: 2000, cacheRead: 0, cacheWrite: 0 },
        }),
      ],
      totalMessages: 1,
      hasPreviousPage: false,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getByText(/in:1\.5k/)).toBeDefined();
    expect(screen.getByText(/out:2\.0k/)).toBeDefined();
  });
});
