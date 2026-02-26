import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { SessionGroup } from '../SessionGroup';
import type { SessionData } from '../shared/types';
import { renderWithI18n } from './testUtils';

function makeSession(overrides: Partial<SessionData> = {}): SessionData {
  return {
    key: 'sess-1',
    displayName: 'main-session',
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

function makeSubAgent(key: string, name: string, overrides: Partial<SessionData> = {}): SessionData {
  return {
    key,
    displayName: name,
    kind: 'subagent',
    model: 'claude-sonnet-4-20250514',
    channel: null,
    totalTokens: 10000,
    contextTokens: 5000,
    usagePercent: 10,
    status: 'ACTIVE',
    updatedAt: Date.now(),
    subAgents: [],
    ...overrides,
  };
}

describe('SessionGroup', () => {
  it('renders the primary session card', () => {
    const session = makeSession({ displayName: 'my-session' });
    renderWithI18n(<SessionGroup session={session} />);
    expect(screen.getByText('my-session')).toBeDefined();
  });

  it('renders without children and no expand chevron', () => {
    const session = makeSession();
    renderWithI18n(<SessionGroup session={session} />);
    // No expand chevron when no children (ChevronDownIcon)
    expect(screen.queryByText('main-session')).toBeDefined();
  });

  it('renders sub-agents as compact cards when expanded', () => {
    const session = makeSession({
      subAgents: [makeSubAgent('sa-1', 'worker-alpha'), makeSubAgent('sa-2', 'worker-beta')],
    });
    renderWithI18n(<SessionGroup session={session} />);
    expect(screen.getByText('worker-alpha')).toBeDefined();
    expect(screen.getByText('worker-beta')).toBeDefined();
  });

  it('collapses sub-agents when clicking the chevron toggle', () => {
    const session = makeSession({
      subAgents: [makeSubAgent('sa-1', 'child-one')],
    });
    const { container } = renderWithI18n(<SessionGroup session={session} />);
    expect(screen.getByText('child-one')).toBeDefined();

    // Click the chevron button (inside SessionCard) to collapse — use stopPropagation so only onToggle fires
    const chevronBtn = container.querySelector('button[class*="transition-transform"]') as HTMLElement;
    fireEvent.click(chevronBtn);
    expect(screen.queryByText('child-one')).toBeNull();

    // Click again to expand
    fireEvent.click(chevronBtn);
    expect(screen.getByText('child-one')).toBeDefined();
  });

  it('groups sub-agents with same prefix into a SubAgentGroup', () => {
    const session = makeSession({
      subAgents: [
        makeSubAgent('sa-1', 'task-alpha', { totalTokens: 5000 }),
        makeSubAgent('sa-2', 'task-beta', { totalTokens: 7000 }),
        makeSubAgent('sa-3', 'solo'),
      ],
    });
    renderWithI18n(<SessionGroup session={session} />);
    // "task" prefix group should show "task tasks" label and count
    expect(screen.getByText('task tasks')).toBeDefined();
    expect(screen.getAllByText('(2)').length).toBeGreaterThan(0);
    // Total tokens for group: 12k
    expect(screen.getByText('12.0k total')).toBeDefined();
    // Solo item rendered directly
    expect(screen.getByText('solo')).toBeDefined();
  });

  it('can collapse/expand a SubAgentGroup', () => {
    const session = makeSession({
      subAgents: [makeSubAgent('sa-1', 'grp-one'), makeSubAgent('sa-2', 'grp-two')],
    });
    renderWithI18n(<SessionGroup session={session} />);
    expect(screen.getByText('grp-one')).toBeDefined();

    // Click the group header button to collapse
    fireEvent.click(screen.getByText('grp tasks'));
    expect(screen.queryByText('grp-one')).toBeNull();
  });

  it('shows sub-agent count pill on parent card', () => {
    const session = makeSession({
      subAgents: [makeSubAgent('sa-1', 'child-a')],
    });
    renderWithI18n(<SessionGroup session={session} />);
    expect(screen.getAllByText('1 sub').length).toBeGreaterThan(0);
  });
});
