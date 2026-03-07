import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { DARK } from '../colors.js';
import { renderFooter } from '../footer.js';
import type { SatoriNode } from '../helpers.js';

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
    for (const child of children) {
      results.push(...collectText(child));
    }
  }
  return results;
}

function collectImageSrc(node: SatoriNode | string | unknown): string[] {
  if (!node || typeof node !== 'object') {
    return [];
  }
  const n = node as SatoriNode;
  const results: string[] = [];
  if (n.type === 'img' && typeof n.props?.src === 'string') {
    results.push(n.props.src);
  }
  const children = n.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      results.push(...collectImageSrc(child));
    }
  }
  return results;
}

function makeData(overrides?: Partial<SnapshotData>): SnapshotData {
  return {
    gateway: { status: 'up', version: '0.9.0', uptime: '2h', cpu: 5, memoryMB: 512 },
    channels: [],
    timestamp: '2026-02-26T14:30:00Z',
    range: '6h',
    time: '14:30',
    summary: {
      activeSessions: 0,
      totalSessions: 0,
      tokens: 0,
      tokensDisplay: '0',
      errors: 0,
      warnings: 0,
      uptimePercent: 100,
    },
    companionDays: 10,
    hostname: 'mini',
    totalConversations: 0,
    ...overrides,
  } as SnapshotData;
}

describe('renderFooter', () => {
  const c = DARK;

  it('renders Claw Insights with version', () => {
    const tree = renderFooter(makeData(), c);
    const texts = collectText(tree);
    expect(texts.join(' ')).toContain('Claw Insights v');
  });

  it('renders datetime from timestamp', () => {
    const tree = renderFooter(makeData(), c);
    const texts = collectText(tree);
    expect(texts.join(' ')).toContain('2026-02-26 14:30');
  });

  it('renders Chinese version when locale is zh', () => {
    const tree = renderFooter(makeData(), c, 'zh');
    const texts = collectText(tree);
    expect(texts.join(' ')).toContain('Claw Insights v');
  });

  it('uses embedded Claw Insights brand icon and never the lobster icon', () => {
    const tree = renderFooter(makeData(), c);
    const sources = collectImageSrc(tree);
    const logoSrc = sources.find((src) => src.startsWith('data:image/svg+xml;base64,'));
    expect(logoSrc).toBeDefined();

    const encoded = logoSrc!.replace('data:image/svg+xml;base64,', '');
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    expect(decoded).not.toContain('lobster-gradient');
    expect(decoded.includes('topFill') || decoded.includes('topFillL')).toBe(true);
  });

  it('does not render Uptime', () => {
    const tree = renderFooter(makeData(), c);
    const texts = collectText(tree);
    expect(texts.join(' ')).not.toContain('Uptime');
  });
});
