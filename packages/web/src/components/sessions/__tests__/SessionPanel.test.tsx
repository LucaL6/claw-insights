import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { SessionData } from '../shared/types';
import { renderWithI18n } from './testUtils';

// Mock useReactiveQuery
const mockUseReactiveQuery = vi.fn();
vi.mock('../../../hooks/useReactiveQuery', () => ({
  useReactiveQuery: (...args: unknown[]) => mockUseReactiveQuery(...args),
}));

// Capture SessionDrawer props
let lastDrawerProps: Record<string, unknown> | undefined;
vi.mock('../SessionDrawer', () => ({
  SessionDrawer: (props: Record<string, unknown>) => {
    lastDrawerProps = props;
    return <div data-testid="session-drawer" />;
  },
}));

// Mock useHashRoute so we can control selected session
const mockNavigate = vi.fn();
let mockRoute = { page: 'dashboard' as const, params: {} as Record<string, string> };
vi.mock('../../../hooks/useHashRoute', () => ({
  useHashRoute: () => ({ route: mockRoute, navigate: mockNavigate }),
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
    lastDrawerProps = undefined;
    mockRoute = { page: 'dashboard', params: {} };
  });

  it('renders sessions when data is available', () => {
    const sessions = [
      makeSession({ key: 's1', displayName: 'session-one' }),
      makeSession({ key: 's2', displayName: 'session-two', status: 'IDLE' }),
    ];
    mockUseReactiveQuery.mockReturnValue([{ data: { sessions }, fetching: false, error: undefined }, vi.fn()]);

    renderWithI18n(<SessionPanel />);
    expect(screen.getByText('session-one')).toBeDefined();
    expect(screen.getByText('session-two')).toBeDefined();
  });

  it('shows skeletons during initial loading', () => {
    mockUseReactiveQuery.mockReturnValue([{ data: undefined, fetching: true, error: undefined }, vi.fn()]);

    const { container } = renderWithI18n(<SessionPanel />);
    // SessionSkeleton renders animated placeholder divs
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('shows empty message when no sessions', () => {
    mockUseReactiveQuery.mockReturnValue([{ data: { sessions: [] }, fetching: false, error: undefined }, vi.fn()]);

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
    mockUseReactiveQuery.mockReturnValue([{ data: { sessions: [] }, fetching: false, error: undefined }, vi.fn()]);

    renderWithI18n(<SessionPanel />);
    // Active/All toggle buttons
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('All').length).toBeGreaterThan(0);
  });

  it('switches view mode when "All" is clicked', () => {
    const sessions = [makeSession()];
    mockUseReactiveQuery.mockReturnValue([{ data: { sessions }, fetching: false, error: undefined }, vi.fn()]);

    renderWithI18n(<SessionPanel />);
    const allBtn = screen.getAllByText('All')[0];
    fireEvent.click(allBtn);
    // After clicking All, the query should be re-invoked with activeOnly=false
    const lastCall = mockUseReactiveQuery.mock.calls.at(-1)?.[0];
    expect(lastCall?.variables?.filter?.activeOnly).toBe(false);
  });

  it('switches sort mode when sort button is clicked', () => {
    const sessions = [makeSession()];
    mockUseReactiveQuery.mockReturnValue([{ data: { sessions }, fetching: false, error: undefined }, vi.fn()]);

    renderWithI18n(<SessionPanel />);
    // Click "Token" sort button (may appear multiple times due to re-render)
    const tokenBtn = screen.getAllByText('Token')[0];
    fireEvent.click(tokenBtn);
    const lastCall = mockUseReactiveQuery.mock.calls.at(-1)?.[0];
    expect(lastCall?.variables?.filter?.sortBy).toBe('TOKENS_DESC');
  });

  it('passes liveSession snapshot to SessionDrawer for selected subagent', () => {
    const sub = makeSession({
      key: 'sub-1',
      displayName: 'my-subagent',
      contextTokens: 9000,
      totalTokens: 20000,
      status: 'ACTIVE',
    });
    const sessions = [makeSession({ key: 's1', subAgents: [sub] })];
    mockUseReactiveQuery.mockReturnValue([{ data: { sessions }, fetching: false, error: undefined }, vi.fn()]);
    mockRoute = { page: 'dashboard', params: { session: 'sub-1' } };

    renderWithI18n(<SessionPanel />);

    expect(lastDrawerProps).toBeDefined();
    expect(lastDrawerProps!.liveSession).toMatchObject({
      key: 'sub-1',
      contextTokens: 9000,
      totalTokens: 20000,
      status: 'ACTIVE',
      displayName: 'my-subagent',
    });
  });

  it('switches back to active view', () => {
    const sessions = [makeSession()];
    mockUseReactiveQuery.mockReturnValue([{ data: { sessions }, fetching: false, error: undefined }, vi.fn()]);

    renderWithI18n(<SessionPanel />);
    // Click All then Active
    fireEvent.click(screen.getAllByText('All')[0]);
    fireEvent.click(screen.getAllByText('Active')[0]);
    const lastCall = mockUseReactiveQuery.mock.calls.at(-1)?.[0];
    expect(lastCall?.variables?.filter?.activeOnly).toBe(true);
  });
});
