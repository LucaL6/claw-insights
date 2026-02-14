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

  it('F2.1.2: displays session name', () => {
    const { getByText } = render(<SessionCard {...baseProps} />);
    expect(getByText('test-session')).toBeDefined();
  });

  it('F2.1.2: displays model name (simplified)', () => {
    const { getByText } = render(<SessionCard {...baseProps} />);
    expect(getByText('opus-4-6')).toBeDefined();
  });

  it('F2.1.2: displays channel', () => {
    const { getByText } = render(<SessionCard {...baseProps} />);
    expect(getByText('webchat')).toBeDefined();
  });

  it('F2.1.2: displays token count', () => {
    const { getByText } = render(<SessionCard {...baseProps} />);
    expect(getByText('50.0k tokens')).toBeDefined();
  });

  it('F2.1.2: displays usage percent', () => {
    const { getByText } = render(<SessionCard {...baseProps} />);
    expect(getByText('25%')).toBeDefined();
  });

  it('F2.1.3: cyan bar when <=50%', () => {
    const { container } = render(<SessionCard {...baseProps} usagePercent={50} />);
    const bar = container.querySelector('[style*="width"]');
    expect(bar?.className).toContain('cyan');
  });

  it('F2.1.3: amber bar when 51-80%', () => {
    const { container } = render(<SessionCard {...baseProps} usagePercent={75} />);
    const bar = container.querySelector('[style*="width"]');
    expect(bar?.className).toContain('amber');
  });

  it('F2.1.3: red bar when >80%', () => {
    const { container } = render(<SessionCard {...baseProps} usagePercent={90} />);
    const bar = container.querySelector('[style*="width"]');
    expect(bar?.className).toContain('red');
  });

  it('shows CRON badge for cron kind', () => {
    const { getByText } = render(<SessionCard {...baseProps} kind="cron" />);
    expect(getByText('CRON')).toBeDefined();
  });

  it('does not show CRON badge for direct kind', () => {
    const { queryByText } = render(<SessionCard {...baseProps} kind="direct" />);
    expect(queryByText('CRON')).toBeNull();
  });
});
