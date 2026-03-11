import { screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionsQuery } from '../../../graphql/queries';
import type { SessionData } from '../shared/types';
import { renderWithI18n } from './testUtils';

const mockUseReactiveQuery = vi.fn();
vi.mock('../../../hooks/useReactiveQuery', () => ({
  useReactiveQuery: (...args: unknown[]) => mockUseReactiveQuery(...args),
}));

vi.mock('../../../graphql/source-selector', () => ({
  getDashboardSourceSelector: () => ({ id: 'agent:main' }),
}));

let lastDrawerProps: Record<string, unknown> | undefined;
vi.mock('../SessionDrawer', () => ({
  SessionDrawer: (props: Record<string, unknown>) => {
    lastDrawerProps = props;
    return <div data-testid="session-drawer" />;
  },
}));

const mockNavigate = vi.fn();
let mockRoute = { page: 'dashboard' as const, params: {} as Record<string, string> };
vi.mock('../../../hooks/useHashRoute', () => ({
  useHashRoute: () => ({ route: mockRoute, navigate: mockNavigate }),
}));

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

function setupQueryMock({ queryData, queryFetching = false }: { queryData?: unknown; queryFetching?: boolean }) {
  mockUseReactiveQuery.mockImplementation((args: { query: unknown }) => {
    if (args.query === SessionsQuery) {
      return [{ data: queryData, fetching: queryFetching, error: undefined }, vi.fn()];
    }
    return [{ data: undefined, fetching: false, error: undefined }, vi.fn()];
  });
}

describe('SessionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastDrawerProps = undefined;
    mockRoute = { page: 'dashboard', params: {} };
  });

  it('renders sessions from source-centric data', () => {
    setupQueryMock({
      queryData: { source: { __typename: 'AgentNamespace', sessions: [makeSession({ displayName: 'session-one' })] } },
    });

    renderWithI18n(<SessionPanel />);
    expect(screen.getByText('session-one')).toBeDefined();
  });

  it('uses canonical query variables with selector + filter', () => {
    setupQueryMock({});

    renderWithI18n(<SessionPanel />);

    const queryCall = mockUseReactiveQuery.mock.calls.find((call) => call[0].query === SessionsQuery)?.[0];
    expect(queryCall.variables).toMatchObject({
      selector: { id: 'agent:main' },
      filter: { activeOnly: true, sortBy: 'UPDATED_AT', grouped: true },
    });
  });

  it('renders empty state when source returns no sessions', () => {
    setupQueryMock({
      queryData: { source: { __typename: 'AgentNamespace', sessions: [] } },
    });

    renderWithI18n(<SessionPanel />);
    expect(screen.getAllByText('No active sessions').length).toBeGreaterThan(0);
  });

  it('shows skeleton when fetching with no data', () => {
    setupQueryMock({ queryFetching: true });

    const { container } = renderWithI18n(<SessionPanel />);
    // Skeleton renders animated placeholder divs
    const skeletons = container.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('handles null source gracefully', () => {
    setupQueryMock({
      queryData: { source: null },
    });

    renderWithI18n(<SessionPanel />);
    expect(screen.getAllByText('No active sessions').length).toBeGreaterThan(0);
  });

  it('passes liveSession snapshot to SessionDrawer for selected subagent', () => {
    const sub = makeSession({ key: 'sub-1', displayName: 'my-subagent', contextTokens: 9000, totalTokens: 20000 });
    setupQueryMock({
      queryData: { source: { __typename: 'AgentNamespace', sessions: [makeSession({ key: 's1', subAgents: [sub] })] } },
    });
    mockRoute = { page: 'dashboard', params: { session: 'sub-1' } };

    renderWithI18n(<SessionPanel />);

    expect(lastDrawerProps?.liveSession).toMatchObject({
      key: 'sub-1',
      contextTokens: 9000,
      totalTokens: 20000,
      displayName: 'my-subagent',
    });
  });
});
