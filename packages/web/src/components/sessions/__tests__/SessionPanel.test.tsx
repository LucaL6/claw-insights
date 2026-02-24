import { screen } from '@testing-library/react';
import { beforeEach,describe, expect, it, vi } from 'vitest';

import type { SessionData } from '../shared/types';
import { renderWithI18n } from './testUtils';

// Mock useReactiveQuery
const mockUseReactiveQuery = vi.fn();
vi.mock('../../../hooks/useReactiveQuery', () => ({
  useReactiveQuery: (...args: unknown[]) => mockUseReactiveQuery(...args),
}));

// Import after mock
import { SessionPanel } from '../SessionPanel';

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    key: 'sess-1',
    displayName: 'test-session',
    kind: 'interactive',
    model: 'claude-sonnet-4-20250514',
    channel: 'webchat',
    totalTokens: 50000,
    contextTokens: 30000,
    usagePercent: 25,
    status: 'ACTIVE',
    updatedAt: Date.now(),
    subAgents: [],
    ...overrides,
  };
}

describe('SessionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders sessions when data is available', () => {
    const sessions = [
      makeSession({ key: 's1', displayName: 'session-one' }),
      makeSession({ key: 's2', displayName: 'session-two', status: 'IDLE' }),
    ];
    mockUseReactiveQuery.mockReturnValue([
      { data: { sessions }, fetching: false, error: undefined },
      vi.fn(),
    ]);

    renderWithI18n(<SessionPanel />);
    expect(screen.getByText('session-one')).toBeDefined();
    expect(screen.getByText('session-two')).toBeDefined();
  });

  it('shows skeletons during initial loading', () => {
    mockUseReactiveQuery.mockReturnValue([
      { data: undefined, fetching: true, error: undefined },
      vi.fn(),
    ]);

    const { container } = renderWithI18n(<SessionPanel />);
    // SessionSkeleton renders animated placeholder divs
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty message when no sessions', () => {
    mockUseReactiveQuery.mockReturnValue([
      { data: { sessions: [] }, fetching: false, error: undefined },
      vi.fn(),
    ]);

    renderWithI18n(<SessionPanel />);
    // The i18n key sessions.noSessions resolves to "No active sessions" or similar
    // Check for the no-sessions text element
    const emptyEl = screen.getByText((content) => content.length > 0, {
      selector: 'p.text-xs',
    });
    expect(emptyEl).toBeDefined();
  });

  it('calls onReady when data arrives', () => {
    const onReady = vi.fn();
    mockUseReactiveQuery.mockReturnValue([
      { data: { sessions: [makeSession()] }, fetching: false, error: undefined },
      vi.fn(),
    ]);

    renderWithI18n(<SessionPanel onReady={onReady} />);
    expect(onReady).toHaveBeenCalled();
  });

  it('renders filter and sort controls', () => {
    mockUseReactiveQuery.mockReturnValue([
      { data: { sessions: [] }, fetching: false, error: undefined },
      vi.fn(),
    ]);

    renderWithI18n(<SessionPanel />);
    // Active/All toggle buttons
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('All').length).toBeGreaterThan(0);
  });
});
