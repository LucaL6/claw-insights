import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { DARK } from '../colors.js';
import type { SatoriNode } from '../helpers.js';
import { renderSessions } from '../sessions.js';

function collectText(node: SatoriNode | string | unknown): string[] {
  if (typeof node === 'string') {
    return [node];
  }
  if (typeof node === 'number') {
    return [String(node)];
  }
  if (!node || typeof node !== 'object') {
    return [];
  }
  const n = node as SatoriNode;
  const results: string[] = [];
  const children = n.props?.children;
  if (typeof children === 'string') {
    results.push(children);
  } else if (Array.isArray(children)) {
    for (const c of children) {
      results.push(...collectText(c));
    }
  }
  return results;
}

describe('renderSessions branches', () => {
  it('returns null for compact detail', () => {
    const data = { sessions: [{ name: 'x' }] } as unknown as SnapshotData;
    expect(renderSessions(data, 'compact', DARK)).toBeNull();
  });

  it('returns null for empty sessions', () => {
    const data = { sessions: [] } as unknown as SnapshotData;
    expect(renderSessions(data, 'standard', DARK)).toBeNull();
  });

  it('returns null for undefined sessions', () => {
    const data = { sessions: undefined } as unknown as SnapshotData;
    expect(renderSessions(data, 'standard', DARK)).toBeNull();
  });

  it('handles session with null usagePercent', () => {
    const data = {
      sessions: [
        {
          name: 'test',
          status: 'idle',
          model: 'm',
          modelDisplay: '',
          channel: 'discord',
          totalTokens: 0,
          totalTokensDisplay: '0',
          usagePercent: null,
          updatedAt: '1m ago',
          subAgentCount: 0,
          turnCount: 0,
        },
      ],
    } as unknown as SnapshotData;
    const tree = renderSessions(data, 'standard', DARK)!;
    expect(tree).not.toBeNull();
  });

  it('renders sub-agent tag when subAgentCount > 0', () => {
    const data = {
      sessions: [
        {
          name: 'main',
          status: 'active',
          model: 'claude',
          modelDisplay: 'Claude',
          channel: 'telegram',
          totalTokens: 1000,
          totalTokensDisplay: '1k',
          usagePercent: 50,
          updatedAt: '2m ago',
          subAgentCount: 3,
          turnCount: 0,
        },
      ],
    } as unknown as SnapshotData;
    const tree = renderSessions(data, 'standard', DARK)!;
    const texts = collectText(tree);
    expect(texts).toContain('3 sub');
  });

  it('renders Chinese labels when locale is zh', () => {
    const data = {
      sessions: [
        {
          name: 'main',
          status: 'active',
          model: 'claude',
          modelDisplay: 'Claude',
          channel: 'telegram',
          totalTokens: 1000,
          totalTokensDisplay: '1k',
          usagePercent: 50,
          updatedAt: '2m ago',
          subAgentCount: 0,
          turnCount: 0,
        },
      ],
    } as unknown as SnapshotData;
    const tree = renderSessions(data, 'standard', DARK, 'zh')!;
    const texts = collectText(tree);
    expect(texts).toContain('会话');
    expect(texts.join(' ')).toContain('活跃');
  });

  it('uses model name when modelDisplay is empty', () => {
    const data = {
      sessions: [
        {
          name: 'test',
          status: 'active',
          model: 'raw-model',
          modelDisplay: '',
          channel: 'discord',
          totalTokens: 100,
          totalTokensDisplay: '0.1k',
          usagePercent: 10,
          updatedAt: '5m ago',
          subAgentCount: 0,
          turnCount: 0,
        },
      ],
    } as unknown as SnapshotData;
    const tree = renderSessions(data, 'standard', DARK)!;
    const texts = collectText(tree);
    expect(texts).toContain('raw-model');
  });
});
