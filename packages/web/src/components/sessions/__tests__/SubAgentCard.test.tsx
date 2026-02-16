import { describe, it, expect, afterEach } from 'bun:test';
import { render, cleanup } from '@testing-library/react';
import { SubAgentCard } from '../SubAgentCard';

afterEach(cleanup);

describe('SubAgentCard', () => {
  const baseProps = {
    displayName: 'review-001',
    model: 'claude-opus-4-6',
    channel: 'webchat' as string | null,
    totalTokens: 12800,
    contextTokens: 200000,
    usagePercent: 6.4,
    status: 'DONE',
    updatedAt: Date.now() - 300_000,
    isLast: false,
  };

  it('displays label', () => {
    const { getByText } = render(<SubAgentCard {...baseProps} />);
    expect(getByText(/review-001/)).toBeDefined();
  });

  it('displays friendly model name', () => {
    const { getByText } = render(<SubAgentCard {...baseProps} />);
    expect(getByText('Opus 4.6')).toBeDefined();
  });

  it('displays token count', () => {
    const { getByText } = render(<SubAgentCard {...baseProps} />);
    expect(getByText('12.8k')).toBeDefined();
  });

  it('shows completion mark for DONE', () => {
    const { getByText } = render(<SubAgentCard {...baseProps} status="DONE" />);
    expect(getByText(/✓/)).toBeDefined();
  });

  it('shows failure mark for FAILED', () => {
    const { getByText } = render(<SubAgentCard {...baseProps} status="FAILED" />);
    expect(getByText(/✕/)).toBeDefined();
  });

  it('shows Starting skeleton when tokens=0 and ACTIVE', () => {
    const { getByText } = render(<SubAgentCard {...baseProps} totalTokens={0} status="ACTIVE" />);
    expect(getByText('Starting...')).toBeDefined();
  });

  it('shows channel pill', () => {
    const { getByText } = render(<SubAgentCard {...baseProps} />);
    expect(getByText('webchat')).toBeDefined();
  });
});
