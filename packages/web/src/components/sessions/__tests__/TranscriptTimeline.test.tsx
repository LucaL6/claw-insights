import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { type TimelineState, TranscriptTimeline } from '../TranscriptTimeline';

vi.mock('../../ui/TruncatedContent', () => ({
  TruncatedContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('react-markdown', () => ({ default: ({ children }: { children: string }) => <span>{children}</span> }));
vi.mock('rehype-highlight', () => ({ default: {} }));

const makeMessage = (role: 'user' | 'assistant' | 'tool', content: string) => ({
  timestamp: '2024-01-01T10:00:00Z',
  role,
  content,
  contentTruncated: false,
  model: role === 'assistant' ? 'claude-sonnet-4-20250514' : undefined,
  usage: role === 'assistant' ? { input: 100, output: 50, cacheRead: 0, cacheWrite: 0 } : undefined,
  toolName: role === 'tool' ? 'read_file' : undefined,
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

  it('renders error state with retry button', () => {
    const retry = vi.fn();
    renderWithProviders(<TranscriptTimeline state={{ status: 'error', retry }} />);
    screen.getByText('Retry').click();
    expect(retry).toHaveBeenCalled();
  });

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

  it('shows load older indicator when there are previous messages', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [makeMessage('user', 'Hello')],
      totalMessages: 50,
      hasPreviousPage: true,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getByText(/49 more messages/)).toBeDefined();
    expect(screen.getByText(/↑/)).toBeDefined();
  });
});
