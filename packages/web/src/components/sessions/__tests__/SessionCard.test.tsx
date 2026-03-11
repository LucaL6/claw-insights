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
    updatedAt: Date.now() - 15_000,
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

  it('does not show Running when latest activity is stale', () => {
    const nowMs = Date.now();
    const { container } = renderWithI18n(
      <SessionCard
        {...baseProps}
        status="ACTIVE"
        turnCount={3}
        totalTokens={3200}
        updatedAt={nowMs - 5 * 60_000}
        referenceNowMs={nowMs}
      />,
    );
    expect(container.textContent).not.toMatch(/running|运行/i);
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

  it('hides model tag when model is unknown', () => {
    const { queryByText } = renderWithI18n(<SessionCard {...baseProps} model="unknown" />);
    expect(queryByText('unknown')).toBeNull();
  });

  it('shows Idle pill when status is IDLE', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} status="IDLE" totalTokens={82000} />);
    expect(container.textContent).toMatch(/idle|空闲/i);
  });

  it('shows Done pill when status is DONE', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} status="DONE" totalTokens={124800} />);
    expect(container.textContent).toMatch(/done|完成/i);
  });

  it('shows Failed pill when status is FAILED', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} status="FAILED" totalTokens={3200} />);
    expect(container.textContent).toMatch(/failed|失败/i);
  });

  it('shows no status pill for unknown status value', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} status="UNKNOWN_STATE" totalTokens={1000} />);
    expect(container.textContent).not.toMatch(/start|启动|running|运行|idle|空闲|done|完成|failed|失败/i);
  });

  it('shows spinner SVG only for starting state', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} status="ACTIVE" totalTokens={0} turnCount={0} />);
    const pill = Array.from(container.querySelectorAll('span')).find((el) => el.textContent?.match(/starting|启动/i));
    expect(pill).toBeDefined();
    expect(pill?.querySelector('svg')).not.toBeNull();
  });

  it('does not show spinner for running state', () => {
    const { container } = renderWithI18n(
      <SessionCard {...baseProps} status="ACTIVE" totalTokens={5000} turnCount={3} />,
    );
    const pill = Array.from(container.querySelectorAll('span')).find((el) => el.textContent?.match(/running|运行/i));
    expect(pill).toBeDefined();
    expect(pill?.querySelector('svg')).toBeNull();
  });

  it('does not show any status pill when active but stale', () => {
    const nowMs = Date.now();
    const { container } = renderWithI18n(
      <SessionCard
        {...baseProps}
        status="ACTIVE"
        turnCount={3}
        totalTokens={45000}
        updatedAt={nowMs - 5 * 60_000}
        referenceNowMs={nowMs}
      />,
    );
    expect(container.textContent).not.toMatch(/start|启动|running|运行|idle|空闲|done|完成|failed|失败/i);
  });
});

describe('SessionCard - keyboard & sessionKey branches', () => {
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

  it('Enter key calls onSelect with sessionKey (primary)', () => {
    const onSelect = vi.fn();
    const { container } = renderWithI18n(<SessionCard {...baseProps} sessionKey="k1" onSelect={onSelect} />);
    const card = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('k1');
  });

  it('Space key calls onSelect with sessionKey (primary)', () => {
    const onSelect = vi.fn();
    const { container } = renderWithI18n(<SessionCard {...baseProps} sessionKey="k1" onSelect={onSelect} />);
    const card = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(card, { key: ' ' });
    expect(onSelect).toHaveBeenCalledWith('k1');
  });

  it('Enter key does nothing when sessionKey is undefined (primary)', () => {
    const onSelect = vi.fn();
    const { container } = renderWithI18n(<SessionCard {...baseProps} onSelect={onSelect} />);
    const card = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('click does nothing when sessionKey is undefined (primary)', () => {
    const onSelect = vi.fn();
    const { container } = renderWithI18n(<SessionCard {...baseProps} onSelect={onSelect} />);
    const card = container.firstElementChild as HTMLElement;
    fireEvent.click(card);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('Enter key calls onSelect with sessionKey (compact)', () => {
    const onSelect = vi.fn();
    const { container } = renderWithI18n(
      <SessionCard {...baseProps} variant="compact" sessionKey="k2" onSelect={onSelect} />,
    );
    const card = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(card, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledWith('k2');
  });

  it('Space key does nothing when sessionKey is undefined (compact)', () => {
    const onSelect = vi.fn();
    const { container } = renderWithI18n(<SessionCard {...baseProps} variant="compact" onSelect={onSelect} />);
    const card = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(card, { key: ' ' });
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('click does nothing when sessionKey is undefined (compact)', () => {
    const onSelect = vi.fn();
    const { container } = renderWithI18n(<SessionCard {...baseProps} variant="compact" onSelect={onSelect} />);
    const card = container.firstElementChild as HTMLElement;
    fireEvent.click(card);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('other keys are ignored (primary)', () => {
    const onSelect = vi.fn();
    const { container } = renderWithI18n(<SessionCard {...baseProps} sessionKey="k1" onSelect={onSelect} />);
    const card = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(card, { key: 'a' });
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe('SessionCard - compact boundary branches', () => {
  const baseProps = {
    displayName: 'sub-1',
    model: 'claude-opus-4-6',
    channel: 'webchat' as string | null,
    totalTokens: 5000,
    usagePercent: 10,
    status: 'ACTIVE',
    updatedAt: Date.now() - 10_000,
    variant: 'compact' as const,
  };

  it('applies selected border in compact variant', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} sessionKey="k1" selected />);
    const card = container.firstElementChild as HTMLElement;
    const borderStyle = card.getAttribute('style') ?? '';
    expect(borderStyle).toContain('var(--violet)');
  });

  it('applies selected border in primary variant', () => {
    const { container } = renderWithI18n(
      <SessionCard {...baseProps} variant="primary" kind="direct" sessionKey="k1" selected />,
    );
    const card = container.firstElementChild as HTMLElement;
    const borderStyle = card.getAttribute('style') ?? '';
    expect(borderStyle).toContain('var(--violet)');
  });

  it('compact FAILED uses subtle border (isDone=true) when not selected', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} status="FAILED" />);
    const card = container.firstElementChild as HTMLElement;
    const borderStyle = card.getAttribute('style') ?? '';
    expect(borderStyle).toContain('var(--border-subtle)');
  });

  it('compact DONE uses subtle border and reduced opacity', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} status="DONE" />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).toContain('opacity-60');
  });

  it('compact ACTIVE (not done) does not have opacity-60', () => {
    const { container } = renderWithI18n(<SessionCard {...baseProps} status="ACTIVE" />);
    const card = container.firstElementChild as HTMLElement;
    expect(card.className).not.toContain('opacity-60');
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
