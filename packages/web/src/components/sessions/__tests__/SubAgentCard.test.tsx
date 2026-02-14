import { describe, it, expect, afterEach } from 'bun:test';
import { render, cleanup } from '@testing-library/react';
import { SubAgentCard } from '../SubAgentCard';

afterEach(cleanup);

describe('SubAgentCard', () => {
  it('F2.3.4: displays label', () => {
    const { getByText } = render(<SubAgentCard label="review-001" status="DONE" totalTokens={5000} isLast={false} />);
    expect(getByText('review-001')).toBeDefined();
  });

  it('F2.3.5: shows RUNNING for ACTIVE status', () => {
    const { getByText } = render(<SubAgentCard label="test" status="ACTIVE" totalTokens={1000} isLast={false} />);
    expect(getByText('RUNNING')).toBeDefined();
  });

  it('F2.3.5: shows DONE for DONE status', () => {
    const { getByText } = render(<SubAgentCard label="test" status="DONE" totalTokens={1000} isLast={false} />);
    expect(getByText('DONE')).toBeDefined();
  });

  it('F2.3.5: shows FAILED for FAILED status', () => {
    const { getByText } = render(<SubAgentCard label="test" status="FAILED" totalTokens={1000} isLast={false} />);
    expect(getByText('FAILED')).toBeDefined();
  });

  it('displays token count in k', () => {
    const { getByText } = render(<SubAgentCard label="test" status="DONE" totalTokens={12800} isLast={false} />);
    expect(getByText('12.8k')).toBeDefined();
  });
});
