import { describe, expect, it } from 'vitest';

import { groupByPrefix } from '../groupByPrefix';

const makeSession = (displayName: string) => ({
  key: `agent:main:subagent:${displayName}`,
  displayName,
  kind: 'direct',
  model: 'claude-opus-4-6',
  channel: 'webchat' as string | null,
  totalTokens: 10000,
  contextTokens: 200000,
  usagePercent: 5,
  status: 'DONE',
  updatedAt: Date.now(),
  subAgents: [],
});

describe('groupByPrefix', () => {
  it('groups items sharing a prefix (split by -)', () => {
    const items = [
      makeSession('design-task1-layout'),
      makeSession('design-task2-typography'),
      makeSession('design-task3-format'),
      makeSession('review-batch1'),
    ];
    const result = groupByPrefix(items);
    expect(result).toHaveLength(2);
    const group = result.find((r) => r.type === 'group');
    expect(group).toBeDefined();
    if (group?.type === 'group') {
      expect(group.prefix).toBe('design');
      expect(group.items).toHaveLength(3);
      expect(group.totalTokens).toBe(30000);
    }
  });

  it('does not group singletons', () => {
    const items = [makeSession('alpha-one'), makeSession('beta-two'), makeSession('gamma-three')];
    const result = groupByPrefix(items);
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.type === 'single')).toBe(true);
  });

  it('returns empty for empty input', () => {
    expect(groupByPrefix([])).toEqual([]);
  });

  it('handles items without dashes', () => {
    const items = [makeSession('standalone'), makeSession('another')];
    const result = groupByPrefix(items);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.type === 'single')).toBe(true);
  });

  it('groups correctly when prefix has multiple segments', () => {
    const items = [makeSession('review-batch1'), makeSession('review-batch2'), makeSession('review-batch3')];
    const result = groupByPrefix(items);
    expect(result).toHaveLength(1);
    if (result[0].type === 'group') {
      expect(result[0].prefix).toBe('review');
      expect(result[0].items).toHaveLength(3);
    }
  });
});
