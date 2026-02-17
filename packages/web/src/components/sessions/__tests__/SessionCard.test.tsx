import { describe, it, expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { SessionCard } from '../SessionCard';
import { renderWithI18n } from './testUtils';

afterEach(cleanup);

describe('SessionCard (primary)', () => {
  const baseProps = {
    displayName: 'test-session',
    model: 'claude-opus-4-6',
    channel: 'webchat' as string | null,
    totalTokens: 50000,
    usagePercent: 25,
    status: 'ACTIVE',
    kind: 'direct',
    updatedAt: Date.now() - 300_000,
  };

  it('displays session name', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} />);
    expect(getByText('test-session')).toBeDefined();
  });

  it('displays friendly model name', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} />);
    expect(getByText('Opus 4.6')).toBeDefined();
  });

  it('displays channel pill', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} />);
    expect(getByText('webchat')).toBeDefined();
  });

  it('displays token count', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} />);
    expect(getByText('50.0k')).toBeDefined();
  });

  it('displays usage percent', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} />);
    expect(getByText('25%')).toBeDefined();
  });

  it('shows CRON badge for cron kind', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} kind="cron" />);
    expect(getByText('CRON')).toBeDefined();
  });

  it('does not show CRON badge for direct kind', () => {
    const { queryByText } = renderWithI18n(<SessionCard {...baseProps} kind="direct" />);
    expect(queryByText('CRON')).toBeNull();
  });

  it('shows sub-agent count', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} subAgentCount={6} />);
    expect(getByText('6 sub')).toBeDefined();
  });
});

describe('SessionCard (compact)', () => {
  const baseProps = {
    displayName: 'review-001',
    model: 'claude-opus-4-6',
    channel: 'webchat' as string | null,
    totalTokens: 12800,
    usagePercent: 6.4,
    status: 'DONE',
    updatedAt: Date.now() - 300_000,
    variant: 'compact' as const,
  };

  it('displays label', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} />);
    expect(getByText(/review-001/)).toBeDefined();
  });

  it('displays friendly model name', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} />);
    expect(getByText('Opus 4.6')).toBeDefined();
  });

  it('displays token count', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} />);
    expect(getByText('12.8k')).toBeDefined();
  });

  it('shows completion mark for DONE', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} status="DONE" />);
    expect(getByText(/✓/)).toBeDefined();
  });

  it('shows failure mark for FAILED', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} status="FAILED" />);
    expect(getByText(/✕/)).toBeDefined();
  });

  it('shows Starting text when tokens=0 and ACTIVE', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} totalTokens={0} status="ACTIVE" />);
    // i18n key: sessions.starting — exact text depends on locale
    expect(container.textContent).toMatch(/start|启动/i);
  });

  it('shows channel pill', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} />);
    expect(getByText('webchat')).toBeDefined();
  });
});
