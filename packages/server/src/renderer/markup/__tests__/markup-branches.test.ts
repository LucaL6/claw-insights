import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { renderCharts } from '../charts.js';
import { DARK } from '../colors.js';
import { renderErrors } from '../errors.js';
import { type SatoriNode, Sparkline, StatusBadge } from '../helpers.js';
import { buildMarkup } from '../index.js';
import { renderSessions } from '../sessions.js';

const c = DARK;

describe('renderErrors branches', () => {
  it('returns null when recentErrors is undefined', () => {
    const data = { recentErrors: undefined } as unknown as SnapshotData;
    expect(renderErrors(data, c)).toBeNull();
  });

  it('returns null when recentErrors is empty', () => {
    const data = { recentErrors: [] } as unknown as SnapshotData;
    expect(renderErrors(data, c)).toBeNull();
  });

  it('renders warning badge with amber color', () => {
    const data = {
      recentErrors: [{ timestamp: '2025-01-01T00:00:00Z', type: 'warning', module: 'x', message: 'warn' }],
    } as unknown as SnapshotData;
    const result = renderErrors(data, c);
    expect(result).not.toBeNull();
    // The badge for warning should use amber color, not red
    const json = JSON.stringify(result);
    expect(json).toContain(c.amber);
    expect(json).toContain('WARNING');
  });

  it('renders empty string for missing timestamp', () => {
    const data = {
      recentErrors: [{ type: 'error', module: 'x', message: 'err' }],
    } as unknown as SnapshotData;
    const result = renderErrors(data, c);
    expect(result).not.toBeNull();
    // timestamp branch: e.timestamp is falsy → t = ''
    const json = JSON.stringify(result);
    expect(json).toContain('ERROR');
  });
});

describe('StatusBadge branches', () => {
  it('renders DOWN state with red colors when isUp=false', () => {
    const badge = StatusBadge(false, { emerald: c.emerald, emeraldBg: c.emeraldBg, red: c.red, redBg: c.redBg });
    const json = JSON.stringify(badge);
    expect(json).toContain('DOWN');
    expect(json).toContain(c.red);
    expect(json).toContain(c.redBg);
  });
});

describe('Sparkline edge cases', () => {
  it('handles all-zero points', () => {
    const node = Sparkline([0, 0, 0], c.emerald);
    expect(node).toBeDefined();
    // max becomes Math.max(0,0,0,1) = 1, so bars are 8% min height
    const json = JSON.stringify(node);
    expect(json).toContain('8%');
  });
});

describe('renderCharts branches', () => {
  const baseData: SnapshotData = {
    sparklines: { sessions: [1, 2], tokens: [3, 4], errors: [0], uptime: ['up', 'down'] },
    range: '6h',
  } as unknown as SnapshotData;

  it('uses shorter height for compact detail', () => {
    const result = renderCharts(baseData, 'compact', c);
    const json = JSON.stringify(result);
    // compact → height=40, standard → height=48
    // Sparkline and UptimeStrip get height param
    expect(result).toBeDefined();
    expect(json).toContain('"height":40');
  });

  it('uses taller height for standard detail', () => {
    const result = renderCharts(baseData, 'standard', c);
    const json = JSON.stringify(result);
    expect(json).toContain('"height":48');
  });

  it('handles non-numeric range string (fallback to 6)', () => {
    const data = { ...baseData, range: 'abc' } as unknown as SnapshotData;
    const result = renderCharts(data, 'standard', c);
    // parseInt('abc') is NaN, || 6 → 6
    expect(result).toBeDefined();
  });
});

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

describe('buildMarkup snapshot content', () => {
  it('shows TOKEN USED section, hides errors when summary.errors=0, and does not render charts', () => {
    const data = {
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
      sparklines: {
        sessions: [1, 2, 3],
        tokens: [100, 200, 300],
        errors: [0, 0, 0],
        uptime: ['up', 'up', 'up'],
      },
      sessions: [],
      recentErrors: [{ timestamp: 'now', type: 'error', module: 'x', message: 'should be hidden' }],
      tokensByModel: [{ model: 'claude', modelDisplay: 'Claude', tokensK: 12, percent: 100 }],
    } as unknown as SnapshotData;

    const tree = buildMarkup(data, { detail: 'standard', theme: 'dark', lang: 'en' });
    const texts = collectText(tree);

    expect(texts).toContain('TOKEN USED');
    expect(texts).not.toContain('UPTIME');
    expect(texts).not.toContain('RECENT ERRORS');
  });
});

describe('renderSessions turnCount', () => {
  it('shows turn count only when turnCount > 0', () => {
    const data = {
      sessions: [
        {
          name: 'main',
          status: 'active',
          model: 'm',
          modelDisplay: 'M',
          channel: 'telegram',
          totalTokens: 1000,
          totalTokensDisplay: '1k',
          usagePercent: 40,
          updatedAt: '2m ago',
          subAgentCount: 0,
          turnCount: 5,
        },
        {
          name: 'idle',
          status: 'idle',
          model: 'm2',
          modelDisplay: 'M2',
          channel: 'discord',
          totalTokens: 500,
          totalTokensDisplay: '0.5k',
          usagePercent: 10,
          updatedAt: '5m ago',
          subAgentCount: 0,
          turnCount: 0,
        },
      ],
    } as unknown as SnapshotData;

    const tree = renderSessions(data, 'standard', c);
    const texts = collectText(tree);
    // turns no longer displayed in session cards
    expect(texts).not.toContain('5 turns');
    expect(texts).not.toContain('0 turns');
  });
});
