import { fireEvent, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SessionsV2Query } from '../../../graphql/queries-v2';
import { I18nProvider } from '../../../i18n/context';
import type { SessionData } from '../shared/types';
import { renderWithI18n } from './testUtils';

const mockUseReactiveQuery = vi.fn();
vi.mock('../../../hooks/useReactiveQuery', () => ({
  useReactiveQuery: (...args: unknown[]) => mockUseReactiveQuery(...args),
}));

const mockIsSchemaV2Enabled = vi.fn();
vi.mock('../../../config/feature-flags', () => ({
  isSchemaV2Enabled: () => mockIsSchemaV2Enabled(),
}));

const mockGetDashboardSourceSelector = vi.fn();
vi.mock('../../../graphql/source-selector', () => ({
  getDashboardSourceSelector: () => mockGetDashboardSourceSelector(),
}));

const mockShouldFallbackToV1 = vi.fn();
vi.mock('../../../graphql/fallback-policy', () => ({
  shouldFallbackToV1: (...args: unknown[]) => mockShouldFallbackToV1(...args),
  getFallbackMode: () => 'sticky',
  getFallbackReasonTag: ({
    namespaceMissing,
    error,
  }: {
    namespaceMissing: boolean;
    error?: { networkError?: unknown } | null;
  }) => {
    if (namespaceMissing) {
      return 'source-null';
    }
    if (error?.networkError) {
      return 'network-error';
    }
    return null;
  },
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

function setupQueryMock({
  v2Data,
  v1Data,
  v2Fetching = false,
  v1Fetching = false,
}: {
  v2Data?: unknown;
  v1Data?: unknown;
  v2Fetching?: boolean;
  v1Fetching?: boolean;
}) {
  mockUseReactiveQuery.mockImplementation((args: { query: unknown }) => {
    if (args.query === SessionsV2Query) {
      return [{ data: v2Data, fetching: v2Fetching, error: undefined }, vi.fn()];
    }
    return [{ data: v1Data, fetching: v1Fetching, error: undefined }, vi.fn()];
  });
}

describe('SessionPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastDrawerProps = undefined;
    mockRoute = { page: 'dashboard', params: {} };
    mockIsSchemaV2Enabled.mockReturnValue(false);
    mockGetDashboardSourceSelector.mockReturnValue({ id: 'agent:main' });
    mockShouldFallbackToV1.mockReturnValue(false);
  });

  it('renders sessions when v1 data is available', () => {
    setupQueryMock({ v1Data: { sessions: [makeSession({ displayName: 'session-one' })] } });

    renderWithI18n(<SessionPanel />);
    expect(screen.getByText('session-one')).toBeDefined();
  });

  it('uses v2 query variables with selector + filter when schema v2 is enabled', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    setupQueryMock({});

    renderWithI18n(<SessionPanel />);

    const v2Call = mockUseReactiveQuery.mock.calls.find((call) => call[0].query === SessionsV2Query)?.[0];
    expect(v2Call.variables).toMatchObject({
      selector: { id: 'agent:main' },
      filter: { activeOnly: true, sortBy: 'UPDATED_AT', grouped: true },
    });
  });

  it('reads sessions from data.source.sessions', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    setupQueryMock({
      v2Data: { source: { __typename: 'AgentNamespace', sessions: [makeSession({ displayName: 'v2-session' })] } },
    });

    renderWithI18n(<SessionPanel />);
    expect(screen.getByText('v2-session')).toBeDefined();
  });

  it('falls back to v1 when fallback policy says true', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    mockShouldFallbackToV1.mockReturnValue(true);
    setupQueryMock({
      v2Data: { source: null },
      v1Data: { sessions: [makeSession({ displayName: 'legacy-session' })] },
    });

    renderWithI18n(<SessionPanel />);

    expect(mockShouldFallbackToV1).toHaveBeenCalled();
    expect(screen.getByText('legacy-session')).toBeDefined();
  });

  it('resets fallback when activeOnly changes', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    mockShouldFallbackToV1.mockReturnValue(true);
    setupQueryMock({ v2Data: { source: null }, v1Data: { sessions: [] } });

    renderWithI18n(<SessionPanel />);
    fireEvent.click(screen.getAllByText('All')[0]);

    const latestV2Call = mockUseReactiveQuery.mock.calls
      .map((c) => c[0])
      .reverse()
      .find((call) => call.query === SessionsV2Query);

    expect(latestV2Call?.variables?.filter?.activeOnly).toBe(false);
  });

  it('resets fallback when sortBy changes', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    mockShouldFallbackToV1.mockReturnValue(true);
    setupQueryMock({ v2Data: { source: null }, v1Data: { sessions: [] } });

    renderWithI18n(<SessionPanel />);
    fireEvent.click(screen.getAllByText('Token')[0]);

    const latestV2Call = mockUseReactiveQuery.mock.calls
      .map((c) => c[0])
      .reverse()
      .find((call) => call.query === SessionsV2Query);

    expect(latestV2Call?.variables?.filter?.sortBy).toBe('TOKENS_DESC');
  });

  it('resets fallback when selector changes', () => {
    mockIsSchemaV2Enabled.mockReturnValue(true);
    mockShouldFallbackToV1.mockReturnValue(true);
    mockGetDashboardSourceSelector.mockReturnValue({ id: 'agent:main' });
    setupQueryMock({ v2Data: { source: null }, v1Data: { sessions: [] } });

    const view = renderWithI18n(<SessionPanel />);
    mockGetDashboardSourceSelector.mockReturnValue({ id: 'agent:secondary' });
    view.rerender(
      <I18nProvider>
        <SessionPanel />
      </I18nProvider>,
    );

    const v2Calls = mockUseReactiveQuery.mock.calls.map((c) => c[0]).filter((call) => call.query === SessionsV2Query);

    expect(v2Calls.some((call) => call.variables?.selector?.id === 'agent:secondary')).toBe(true);
  });

  it('passes liveSession snapshot to SessionDrawer for selected subagent', () => {
    const sub = makeSession({ key: 'sub-1', displayName: 'my-subagent', contextTokens: 9000, totalTokens: 20000 });
    setupQueryMock({ v1Data: { sessions: [makeSession({ key: 's1', subAgents: [sub] })] } });
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
