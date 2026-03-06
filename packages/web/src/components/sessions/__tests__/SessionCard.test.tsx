import { cleanup, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

  it('shows Starting text when tokens=0, turnCount=0 and ACTIVE', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} totalTokens={0} turnCount={0} status="ACTIVE" />);
    expect(container.textContent).toMatch(/start|启动/i);
  });

  it('shows Running text when tokens=0, turnCount>0 and ACTIVE', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} totalTokens={0} turnCount={3} status="ACTIVE" />);
    expect(container.textContent).toMatch(/running|运行/i);
  });

  it('shows Running text when tokens>0 and turnCount>0 while ACTIVE', () => {
    const { container, getByText } = renderWithI18n(
      <SessionCard {...baseProps} totalTokens={3200} turnCount={3} status="ACTIVE" />,
    );
    expect(getByText('3.2k')).toBeDefined();
    expect(container.textContent).toMatch(/running|运行/i);
  });

  it('does not show Starting/Running when turnCount is unknown', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} totalTokens={0} status="ACTIVE" />);
    expect(container.textContent).not.toMatch(/start|启动|running|运行/i);
  });

  it('shows channel pill', () => {
    const { getByText } = renderWithI18n(<SessionCard {...baseProps} />);
    expect(getByText('webchat')).toBeDefined();
  });

  it('hides channel pill when channel is null', () => {
    const { queryByText } = renderWithI18n(<SessionCard {...baseProps} channel={null} />);
    expect(queryByText('webchat')).toBeNull();
  });
});

describe('SessionCard (primary) - interactions', () => {
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

  it('renders expand button when hasChildren', () => {
    const onToggle = vi.fn();
    const { container } = renderWithI18n(
      <SessionCard {...baseProps} hasChildren onToggle={onToggle} expanded={false} />,
    );
    const btn = container.querySelector('button');
    expect(btn).toBeDefined();
    fireEvent.click(btn!);
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('does not render expand button without hasChildren', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} />);
    // Only buttons should be none (no chevron)
    const buttons = container.querySelectorAll('button');
    expect(buttons.length).toBe(0);
  });

  it('applies warn border when ACTIVE and usage > 80%', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} usagePercent={90} />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.style.border).toBeTruthy();
  });

  it('handles hover events without error', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} />);
    const card = container.firstElementChild as HTMLElement;
    // Should not throw on hover cycle
    fireEvent.mouseEnter(card);
    fireEvent.mouseLeave(card);
    expect(card).toBeDefined();
  });

  it('handles compact hover events without error', () => {
    const { container } = renderWithI18n(
      <SessionCard {...baseProps} variant="compact" status="ACTIVE" totalTokens={5000} />,
    );
    const card = container.firstElementChild as HTMLElement;
    fireEvent.mouseEnter(card);
    fireEvent.mouseLeave(card);
    expect(card).toBeDefined();
  });

  it('shows null channel in compact variant', () => {
    const { queryByText } = renderWithI18n(
      <SessionCard {...baseProps} variant="compact" channel={null} totalTokens={5000} />,
    );
    expect(queryByText('webchat')).toBeNull();
  });
});
