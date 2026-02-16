import { describe, it, expect, afterEach } from 'bun:test';
import { render, cleanup } from '@testing-library/react';
import { SessionCard } from '../SessionCard';

afterEach(cleanup);

describe('SessionCard', () => {
  const baseProps = {
    displayName: 'test-session',
    model: 'claude-opus-4-6',
    channel: 'webchat' as string | null,
    totalTokens: 50000,
    contextTokens: 200000,
    usagePercent: 25,
    status: 'ACTIVE',
    kind: 'direct',
    updatedAt: Date.now() - 300_000,
  };

  it('displays session name', () => {
    const { getByText } = render(<SessionCard {...baseProps} />);
    expect(getByText('test-session')).toBeDefined();
  });

  it('displays friendly model name', () => {
    const { getByText } = render(<SessionCard {...baseProps} />);
    expect(getByText('Opus 4.6')).toBeDefined();
  });

  it('displays channel pill', () => {
    const { getByText } = render(<SessionCard {...baseProps} />);
    expect(getByText('webchat')).toBeDefined();
  });

  it('displays token count', () => {
    const { getByText } = render(<SessionCard {...baseProps} />);
    expect(getByText('50.0k')).toBeDefined();
  });

  it('displays usage percent', () => {
    const { getByText } = render(<SessionCard {...baseProps} />);
    expect(getByText('25%')).toBeDefined();
  });

  it('shows CRON badge for cron kind', () => {
    const { getByText } = render(<SessionCard {...baseProps} kind="cron" />);
    expect(getByText('CRON')).toBeDefined();
  });

  it('does not show CRON badge for direct kind', () => {
    const { queryByText } = render(<SessionCard {...baseProps} kind="direct" />);
    expect(queryByText('CRON')).toBeNull();
  });

  it('shows sub-agent count', () => {
    const { getByText } = render(<SessionCard {...baseProps} subAgentCount={6} />);
    expect(getByText('6 sub')).toBeDefined();
  });
});
