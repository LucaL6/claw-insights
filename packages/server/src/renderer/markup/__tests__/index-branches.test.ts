import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import type { SatoriNode } from '../helpers.js';
import { buildMarkup } from '../index.js';

function collectText(node: SatoriNode | string | unknown): string[] {
  if (typeof node === 'string') {return [node];}
  if (typeof node === 'number') {return [String(node)];}
  if (!node || typeof node !== 'object') {return [];}
  const n = node as SatoriNode;
  const results: string[] = [];
  const children = n.props?.children;
  if (typeof children === 'string') {results.push(children);}
  else if (Array.isArray(children)) {for (const c of children) {results.push(...collectText(c));}}
  return results;
}

function countChildren(node: SatoriNode): number {
  const children = node.props?.children;
  return Array.isArray(children) ? children.length : 0;
}

const baseData: SnapshotData = {
  gateway: { status: 'up', version: '1.0.0', uptime: '2d', cpu: 5, memoryMB: 100 },
  channels: [],
  timestamp: '2026-02-23T00:00:00Z',
  range: '6h',
  time: '00:00',
  summary: {
    activeSessions: 2,
    totalSessions: 3,
    tokens: 12000,
    tokensDisplay: '12k',
    errors: 0,
    warnings: 0,
    uptimePercent: 99.5,
    totalMessages: 100,
  },
  sessions: [],
  recentErrors: [],
  tokensByModel: [{ model: 'claude', modelDisplay: 'Claude', tokensK: 12, percent: 100 }],
  companionDays: 30,
  hostname: 'mini',
  totalConversations: 100,
} as unknown as SnapshotData;

describe('buildMarkup branches', () => {
  it('light theme produces no ambient blobs', () => {
    const tree = buildMarkup(baseData, { detail: 'standard', theme: 'light', lang: 'en' });
    const darkTree = buildMarkup(baseData, { detail: 'standard', theme: 'dark', lang: 'en' });
    // Dark theme has 2 extra blob children
    expect(countChildren(darkTree)).toBeGreaterThan(countChildren(tree));
  });

  it('compact detail skips sessions and errors sections', () => {
    const compactTree = buildMarkup(
      { ...baseData, summary: { ...baseData.summary, errors: 3 } } as unknown as SnapshotData,
      { detail: 'compact', theme: 'dark', lang: 'en' },
    );
    const fullTree = buildMarkup(
      { ...baseData, summary: { ...baseData.summary, errors: 3 } } as unknown as SnapshotData,
      { detail: 'full', theme: 'dark', lang: 'en' },
    );
    expect(countChildren(compactTree)).toBeLessThan(countChildren(fullTree));
  });

  it('full detail with errors > 0 renders errors section', () => {
    const data = {
      ...baseData,
      summary: { ...baseData.summary, errors: 2 },
      recentErrors: [{ timestamp: 'now', type: 'error', module: 'x', message: 'fail' }],
    } as unknown as SnapshotData;
    const tree = buildMarkup(data, { detail: 'full', theme: 'dark', lang: 'en' });
    const texts = collectText(tree);
    expect(texts.join(' ')).toContain('ERROR');
  });

  it('standard detail with errors = 0 skips errors section', () => {
    const tree = buildMarkup(baseData, { detail: 'standard', theme: 'dark', lang: 'en' });
    const texts = collectText(tree);
    expect(texts).not.toContain('RECENT ERRORS');
  });
});
