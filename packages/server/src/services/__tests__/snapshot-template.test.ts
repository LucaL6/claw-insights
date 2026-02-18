import { describe, test, expect } from 'vitest';
import { renderSnapshot } from '../snapshot-template/index';
import { renderHeader } from '../snapshot-template/header';
import { renderFooter } from '../snapshot-template/footer';
import { renderMetrics } from '../snapshot-template/metrics';
import { renderSessions } from '../snapshot-template/sessions';
import { renderCharts } from '../snapshot-template/charts';
import { renderErrors } from '../snapshot-template/errors';
import { esc, sparklineHtml, uptimeStripHtml, bucketChartHtml, tag, COLORS } from '../snapshot-template/constants';
import type { SnapshotData } from '../snapshot-types';

const mockData: SnapshotData = {
  gateway: { status: 'up', version: '2026.2.12', uptime: '2d', cpu: 8, memoryMB: 1135 },
  channels: [{ name: 'TG', provider: 'telegram', connected: true, latencyMs: 45 }],
  timestamp: '2026-02-17T12:57:00Z',
  range: '24h',
  time: '12:57',
  summary: {
    activeSessions: 28,
    totalSessions: 42,
    tokens: 5435800,
    tokensDisplay: '5435.8k',
    errors: 148,
    warnings: 2,
    uptimePercent: 100,
  },
  sparklines: {
    sessions: [45, 65, 80, 100, 70],
    tokens: [30, 50, 90, 100, 60],
    errors: [80, 40, 10, 35, 90],
    uptime: ['up', 'up', 'degraded', 'up', 'up'],
  },
  sessions: [
    {
      name: 'Main Agent',
      status: 'active',
      model: 'anthropic/claude-opus-4-6',
      modelDisplay: 'Opus 4.6',
      channel: 'discord',
      totalTokens: 50000,
      totalTokensDisplay: '50.0k',
      usagePercent: 45,
      updatedAt: '5m ago',
      subAgentCount: 2,
      subAgents: [
        { name: 'Sub A', status: 'running', completed: false, updatedAt: '2m ago' },
        { name: 'Sub B', status: 'done', completed: true, updatedAt: '3m ago' },
      ],
    },
  ],
  buckets: [
    { tokensK: 10, errors: 2, sessions: 5 },
    { tokensK: 20, errors: 1, sessions: 8 },
  ],
  recentErrors: [
    { timestamp: '2026-02-17T12:50:00Z', type: 'error', module: 'core', message: 'Connection timeout' },
  ],
};

// ─── Constants helpers ───────────────────────────────────────────

describe('esc', () => {
  test('escapes HTML entities', () => {
    expect(esc('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
    );
  });
  test('handles ampersand', () => {
    expect(esc('a & b')).toBe('a &amp; b');
  });
});

describe('sparklineHtml', () => {
  test('renders bars', () => {
    const html = sparklineHtml([50, 100], '52,211,153');
    expect(html).toContain('class="sparkline"');
    expect(html).toContain('class="bar"');
  });
  test('returns empty for empty array', () => {
    expect(sparklineHtml([], '0,0,0')).toBe('');
  });
});

describe('uptimeStripHtml', () => {
  test('renders uptime states', () => {
    const html = uptimeStripHtml(['up', 'degraded', 'down']);
    expect(html).toContain(COLORS.emerald);
    expect(html).toContain(COLORS.amber);
    expect(html).toContain(COLORS.red);
  });
});

describe('tag', () => {
  test('renders tag with scheme', () => {
    const html = tag('Opus 4.6', COLORS.tagModel);
    expect(html).toContain('Opus 4.6');
    expect(html).toContain(COLORS.tagModel.bg);
  });
  test('escapes content', () => {
    const html = tag('<bad>', COLORS.tagModel);
    expect(html).toContain('&lt;bad&gt;');
  });
});

// ─── Component tests ─────────────────────────────────────────────

describe('renderHeader', () => {
  test('shows brand name and status', () => {
    const html = renderHeader(mockData, 'compact');
    expect(html).toContain('Claw Insights');
    expect(html).toContain('UP');
  });
  test('compact omits version', () => {
    const html = renderHeader(mockData, 'compact');
    expect(html).not.toContain('2026.2.12');
  });
  test('standard shows version', () => {
    const html = renderHeader(mockData, 'standard');
    expect(html).toContain('2026.2.12');
  });
  test('full shows CPU and MEM', () => {
    const html = renderHeader(mockData, 'full');
    expect(html).toContain('CPU 8');
    expect(html).toContain('MEM 1135MB');
  });
});

describe('renderFooter', () => {
  test('shows channel status', () => {
    const html = renderFooter(mockData);
    expect(html).toContain('TG');
    expect(html).toContain('1 channel OK');
  });
});

describe('renderMetrics', () => {
  test('compact renders 2x2 grid with sparklines', () => {
    const html = renderMetrics(mockData, 'compact');
    expect(html).toContain('grid-cols-2');
    expect(html).toContain('Active Sessions');
    expect(html).toContain('sparkline');
  });
  test('standard renders 4-col row without sparklines', () => {
    const html = renderMetrics(mockData, 'standard');
    expect(html).toContain('grid-cols-4');
  });
});

describe('renderSessions', () => {
  test('renders session cards', () => {
    const html = renderSessions(mockData, 'standard');
    expect(html).toContain('Main Agent');
    expect(html).toContain('Opus 4.6');
  });
  test('standard hides sub-agents', () => {
    const html = renderSessions(mockData, 'standard');
    expect(html).not.toContain('Sub A');
  });
  test('full shows sub-agent tree', () => {
    const html = renderSessions(mockData, 'full');
    expect(html).toContain('Sub A');
    expect(html).toContain('Sub B');
    expect(html).toContain('tree-line');
  });
  test('returns empty for no sessions', () => {
    const noSessions = { ...mockData, sessions: undefined };
    expect(renderSessions(noSessions, 'standard')).toBe('');
  });
});

describe('renderCharts', () => {
  test('compact returns empty', () => {
    expect(renderCharts(mockData, 'compact')).toBe('');
  });
  test('standard renders mini sparkline charts', () => {
    const html = renderCharts(mockData, 'standard');
    expect(html).toContain('Tokens (24h)');
    expect(html).toContain('Errors (24h)');
  });
  test('full renders bucket charts + uptime strip', () => {
    const html = renderCharts(mockData, 'full');
    expect(html).toContain('Token Consumption');
    expect(html).toContain('Gateway Errors');
    expect(html).toContain('Uptime');
  });
});

describe('renderErrors', () => {
  test('renders error list', () => {
    const html = renderErrors(mockData);
    expect(html).toContain('Recent Errors');
    expect(html).toContain('Connection timeout');
  });
  test('returns empty for no errors', () => {
    const noErrors = { ...mockData, recentErrors: undefined };
    expect(renderErrors(noErrors)).toBe('');
  });
});

// ─── Integration ─────────────────────────────────────────────────

describe('renderSnapshot', () => {
  test('compact: has header + metrics + footer, no sessions', () => {
    const html = renderSnapshot(mockData, { detail: 'compact', theme: 'dark', lang: 'en' });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('lang="en"');
    expect(html).toContain('data-theme="dark"');
    expect(html).toContain('Claw Insights');
    expect(html).toContain('Active Sessions');
    expect(html).toContain('channel OK');
    expect(html).not.toContain('Main Agent');
    expect(html).toContain('data-ready');
  });

  test('standard: has sessions + mini charts', () => {
    const html = renderSnapshot(mockData, { detail: 'standard', theme: 'dark', lang: 'en' });
    expect(html).toContain('Main Agent');
    expect(html).toContain('Tokens (24h)');
    expect(html).not.toContain('Recent Errors');
  });

  test('full: has everything', () => {
    const html = renderSnapshot(mockData, { detail: 'full', theme: 'light', lang: 'zh' });
    expect(html).toContain('lang="zh"');
    expect(html).toContain('data-theme="light"');
    expect(html).toContain('Main Agent');
    expect(html).toContain('Sub A');
    expect(html).toContain('Token Consumption');
    expect(html).toContain('Recent Errors');
    expect(html).toContain('Connection timeout');
  });

  test('sets correct viewport width', () => {
    const compact = renderSnapshot(mockData, { detail: 'compact', theme: 'dark', lang: 'en' });
    expect(compact).toContain('w-[390px]');
    const standard = renderSnapshot(mockData, { detail: 'standard', theme: 'dark', lang: 'en' });
    expect(standard).toContain('w-[540px]');
  });
});
