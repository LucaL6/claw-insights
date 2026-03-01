import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '../../../test/render';
import { type TimelineState, TranscriptTimeline } from '../TranscriptTimeline';

// Mock TruncatedContent to just render children
vi.mock('../../ui/TruncatedContent', () => ({
  TruncatedContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock react-markdown to avoid ESM issues in happy-dom
vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <span>{children}</span>,
}));

vi.mock('rehype-highlight', () => ({
  default: {},
}));

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
    const pulsingElements = container.querySelectorAll('.animate-pulse');
    expect(pulsingElements.length).toBeGreaterThan(0);
  });

  it('renders empty state message', () => {
    renderWithProviders(<TranscriptTimeline state={{ status: 'empty' }} />);
    expect(screen.getByText('No messages in this session')).toBeDefined();
  });

  it('renders error state with retry button', () => {
    const retry = vi.fn();
    renderWithProviders(<TranscriptTimeline state={{ status: 'error', retry }} />);
    expect(screen.getByText('Failed to load transcript')).toBeDefined();
    const retryBtn = screen.getByText('Retry');
    retryBtn.click();
    expect(retry).toHaveBeenCalled();
  });

  it('renders messages with correct role labels', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [makeMessage('user', 'Hello'), makeMessage('assistant', 'Hi'), makeMessage('tool', 'result')],
      totalMessages: 3,
      hasMore: false,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getByText('user')).toBeDefined();
    expect(screen.getByText('assistant')).toBeDefined();
    expect(screen.getByText('TOOL')).toBeDefined();
  });

  it('shows hasMore indicator when there are more messages', () => {
    const state: TimelineState = {
      status: 'ready',
      messages: [makeMessage('user', 'Hello')],
      totalMessages: 50,
      hasMore: true,
    };
    renderWithProviders(<TranscriptTimeline state={state} />);
    expect(screen.getByText(/49 more messages/)).toBeDefined();
  });
});
