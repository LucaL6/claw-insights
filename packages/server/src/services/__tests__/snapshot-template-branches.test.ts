import { describe, test, expect } from 'vitest';
import { renderErrors } from '../snapshot-template/errors.js';
import { renderFooter } from '../snapshot-template/footer.js';
import { renderCharts } from '../snapshot-template/charts.js';
import { renderMetrics } from '../snapshot-template/metrics.js';
import { renderSessions } from '../snapshot-template/sessions.js';
import { renderHeader } from '../snapshot-template/header.js';
import type { SnapshotData, SnapshotSession } from '../snapshot-types.js';

// ─── Helpers ─────────────────────────────────────────────────────

function baseData(overrides: Partial<SnapshotData> = {}): SnapshotData {
  return {
    gateway: { status: 'up', version: '1.0.0', uptime: '1d', cpu: 10, memoryMB: 128 },
    channels: [{ name: 'main', provider: 'discord', connected: true, latencyMs: 10 }],
    timestamp: new Date().toISOString(),
    range: '24h',
    time: '14:00',
    summary: {
      activeSessions: 2,
      totalSessions: 5,
      tokens: 100000,
      tokensDisplay: '100K',
      errors: 3,
      warnings: 1,
      uptimePercent: 99.5,
    },
    sparklines: {
      sessions: [0, 50, 100],
      tokens: [10, 50, 80],
      errors: [0, 0, 5],
      uptime: ['up', 'up', 'up'],
    },
    ...overrides,
  };
}

function makeSession(overrides: Partial<SnapshotSession> = {}): SnapshotSession {
  return {
    name: 'Test',
    status: 'active',
    model: 'claude',
    modelDisplay: 'Claude',
    channel: 'discord',
    totalTokens: 5000,
    totalTokensDisplay: '5K',
    usagePercent: 30,
    updatedAt: '2m ago',
    subAgentCount: 0,
    ...overrides,
  };
}

// ─── errors.ts ───────────────────────────────────────────────────

describe('renderErrors', () => {
  test('returns empty when no errors', () => {
    expect(renderErrors(baseData())).toBe('');
    expect(renderErrors(baseData({ recentErrors: [] }))).toBe('');
  });

  test('error badge for level=error', () => {
    const html = renderErrors(baseData({
      recentErrors: [{ timestamp: '2026-01-01T00:00:00Z', type: 'error', module: 'core', message: 'fail' }],
    }));
    expect(html).toContain('>error</span>');
  });

  test('error badge for level=warn', () => {
    const html = renderErrors(baseData({
      recentErrors: [{ timestamp: '2026-01-01T00:00:00Z', type: 'warn', module: 'core', message: 'warning' }],
    }));
    expect(html).toContain('>warn</span>');
  });

  test('error badge for unknown level', () => {
    const html = renderErrors(baseData({
      recentErrors: [{ timestamp: '2026-01-01T00:00:00Z', type: 'info', module: 'core', message: 'info' }],
    }));
    expect(html).toContain('>info</span>');
  });

  test('shows "more" when >5 errors', () => {
    const errors = Array.from({ length: 7 }, (_, i) => ({
      timestamp: '2026-01-01T00:00:00Z', type: 'error', module: 'core', message: `err${i}`,
    }));
    const html = renderErrors(baseData({ recentErrors: errors }));
    expect(html).toContain('2 more errors');
  });

  test('no "more" when <=5 errors', () => {
    const errors = Array.from({ length: 3 }, (_, i) => ({
      timestamp: '2026-01-01T00:00:00Z', type: 'error', module: 'core', message: `err${i}`,
    }));
    const html = renderErrors(baseData({ recentErrors: errors }));
    expect(html).not.toContain('more errors');
  });

  test('handles missing timestamp', () => {
    const html = renderErrors(baseData({
      recentErrors: [{ timestamp: '', type: 'error', module: 'core', message: 'fail' }],
    }));
    expect(html).toContain('error');
  });
});

// ─── footer.ts ───────────────────────────────────────────────────

describe('renderFooter', () => {
  test('connected channel gets green dot', () => {
    const html = renderFooter(baseData());
    expect(html).toContain('bg-[#34d399]');
  });

  test('disconnected channel gets red dot', () => {
    const html = renderFooter(baseData({
      channels: [{ name: 'test', provider: 'slack', connected: false, latencyMs: null }],
    }));
    expect(html).toContain('bg-[#ef4444]');
  });

  test('singular "channel" when 1 connected', () => {
    const html = renderFooter(baseData({
      channels: [{ name: 'a', provider: 'discord', connected: true, latencyMs: 10 }],
    }));
    expect(html).toContain('1 channel OK');
    expect(html).not.toContain('channels');
  });

  test('plural "channels" when multiple connected', () => {
    const html = renderFooter(baseData({
      channels: [
        { name: 'a', provider: 'discord', connected: true, latencyMs: 10 },
        { name: 'b', provider: 'slack', connected: true, latencyMs: 20 },
      ],
    }));
    expect(html).toContain('2 channels OK');
  });

  test('0 channels OK', () => {
    const html = renderFooter(baseData({
      channels: [{ name: 'a', provider: 'discord', connected: false, latencyMs: null }],
    }));
    expect(html).toContain('0 channels OK');
  });
});

// ─── charts.ts ───────────────────────────────────────────────────

describe('renderCharts', () => {
  test('compact returns empty', () => {
    expect(renderCharts(baseData(), 'compact')).toBe('');
  });

  test('standard returns mini charts', () => {
    const html = renderCharts(baseData(), 'standard');
    expect(html).toContain('Tokens (24h)');
    expect(html).toContain('Errors (24h)');
  });

  test('full returns bucket charts with token/error/uptime sections', () => {
    const data = baseData({
      buckets: [
        { tokensK: 10, errors: 2, uptimePercent: 100 },
        { tokensK: 20, errors: 0, uptimePercent: 80 },
      ],
      sparklines: { sessions: [0, 100], tokens: [0, 100], errors: [0, 100], uptime: ['up', 'degraded', 'down'] },
    });
    const html = renderCharts(data, 'full');
    expect(html).toContain('Token Consumption');
    expect(html).toContain('Gateway Errors');
    expect(html).toContain('Uptime');
    // uptime strip colors
    expect(html).toContain('bg-emerald-500/40');
    expect(html).toContain('bg-amber-500/50');
    expect(html).toContain('bg-red-500/50');
  });

  test('full with empty buckets omits token/error charts', () => {
    const data = baseData({ buckets: [], sparklines: { sessions: [], tokens: [], errors: [], uptime: [] } });
    const html = renderCharts(data, 'full');
    expect(html).not.toContain('Token Consumption');
    expect(html).not.toContain('Gateway Errors');
    expect(html).not.toContain('Uptime');
  });

  test('full bucket uses tokens fallback when no tokensK', () => {
    const data = baseData({
      buckets: [{ tokens: 500, errors: 1 }],
      sparklines: { sessions: [], tokens: [], errors: [], uptime: ['up'] },
    });
    const html = renderCharts(data, 'full');
    expect(html).toContain('Token Consumption');
  });

  test('full uptime shows — when uptimePercent is null', () => {
    const data = baseData({
      buckets: [{ tokensK: 1, errors: 0 }],
      sparklines: { sessions: [], tokens: [], errors: [], uptime: ['up'] },
    });
    (data.summary as any).uptimePercent = null;
    const html = renderCharts(data, 'full');
    expect(html).toContain('—');
  });
});

// ─── metrics.ts ──────────────────────────────────────────────────

describe('renderMetrics', () => {
  test('compact renders 2x2 grid with sparklines', () => {
    const html = renderMetrics(baseData(), 'compact');
    expect(html).toContain('grid-cols-2');
    expect(html).toContain('Active Sessions');
  });

  test('standard renders 4-col row', () => {
    const html = renderMetrics(baseData(), 'standard');
    expect(html).toContain('grid-cols-4');
  });

  test('full renders 4-col row', () => {
    const html = renderMetrics(baseData(), 'full');
    expect(html).toContain('grid-cols-4');
  });

  test('uptimePercent null shows —', () => {
    const data = baseData();
    (data.summary as any).uptimePercent = null;
    const html = renderMetrics(data, 'compact');
    expect(html).toContain('—');
  });

  test('uptimePercent renders percentage in compact', () => {
    const html = renderMetrics(baseData(), 'compact');
    expect(html).toContain('99.5%');
  });
});

// ─── sessions.ts ─────────────────────────────────────────────────

describe('renderSessions', () => {
  test('returns empty when no sessions', () => {
    expect(renderSessions(baseData(), 'standard')).toBe('');
    expect(renderSessions(baseData({ sessions: [] }), 'standard')).toBe('');
  });

  test('inactive session gets muted dot', () => {
    const data = baseData({ sessions: [makeSession({ status: 'idle' })] });
    const html = renderSessions(data, 'standard');
    expect(html).not.toContain('pulse');
  });

  test('active session gets pulse dot', () => {
    const data = baseData({ sessions: [makeSession({ status: 'active' })] });
    const html = renderSessions(data, 'standard');
    expect(html).toContain('pulse');
  });

  test('standard does not include subAgents tree', () => {
    const data = baseData({ sessions: [makeSession({ subAgentCount: 2 })] });
    const html = renderSessions(data, 'standard');
    expect(html).not.toContain('tree-line');
  });

  test('full includes subAgents tree', () => {
    const data = baseData({
      sessions: [makeSession({
        subAgentCount: 2,
        subAgents: [
          { name: 'sub1', status: 'active', completed: false, updatedAt: '1m ago' },
          { name: 'sub2', status: 'done', completed: true, updatedAt: '5m ago' },
        ],
      })],
    });
    const html = renderSessions(data, 'full');
    expect(html).toContain('tree-line');
    expect(html).toContain('sub1');
    expect(html).toContain('✓');
  });

  test('sub-agent running gets pulse', () => {
    const data = baseData({
      sessions: [makeSession({
        subAgentCount: 1,
        subAgents: [{ name: 'sub1', status: 'running', completed: false, updatedAt: '1m ago' }],
      })],
    });
    const html = renderSessions(data, 'full');
    // running sub-agent should have pulse class
    expect(html).toContain('pulse');
  });

  test('>4 sub-agents shows "+N more"', () => {
    const subs = Array.from({ length: 6 }, (_, i) => ({
      name: `sub${i}`, status: 'idle', completed: false, updatedAt: '1m ago',
    }));
    const data = baseData({
      sessions: [makeSession({ subAgentCount: 6, subAgents: subs })],
    });
    const html = renderSessions(data, 'full');
    expect(html).toContain('+2 more sub-agents');
  });

  test('standard shows remaining count', () => {
    const data = baseData({
      sessions: [makeSession()],
      // totalSessions=5, sessions.length=1, so remaining=4
    });
    data.summary.totalSessions = 5;
    const html = renderSessions(data, 'standard');
    expect(html).toContain('+4 more sessions');
  });

  test('full shows "Active Sessions" heading', () => {
    const data = baseData({ sessions: [makeSession()] });
    const html = renderSessions(data, 'full');
    expect(html).toContain('Active Sessions');
  });

  test('standard shows "Sessions" heading', () => {
    const data = baseData({ sessions: [makeSession()] });
    const html = renderSessions(data, 'standard');
    expect(html).toContain('>Sessions<');
  });

  test('session with no subAgents hides sub tag', () => {
    const data = baseData({ sessions: [makeSession({ subAgentCount: 0 })] });
    const html = renderSessions(data, 'standard');
    expect(html).not.toContain('sub');
  });

  test('session with subAgents shows sub tag', () => {
    const data = baseData({ sessions: [makeSession({ subAgentCount: 3 })] });
    const html = renderSessions(data, 'standard');
    expect(html).toContain('3 sub');
  });
});

// ─── header.ts ───────────────────────────────────────────────────

describe('renderHeader', () => {
  test('gateway up shows UP badge', () => {
    const html = renderHeader(baseData(), 'compact');
    expect(html).toContain('UP');
  });

  test('gateway down shows DOWN badge', () => {
    const data = baseData();
    data.gateway.status = 'down';
    const html = renderHeader(data, 'compact');
    expect(html).toContain('DOWN');
  });

  test('compact hides version', () => {
    const html = renderHeader(baseData(), 'compact');
    expect(html).not.toContain('1.0.0');
  });

  test('standard shows version', () => {
    const html = renderHeader(baseData(), 'standard');
    expect(html).toContain('1.0.0');
  });

  test('full shows CPU and MEM', () => {
    const html = renderHeader(baseData(), 'full');
    expect(html).toContain('CPU 10');
    expect(html).toContain('MEM 128MB');
    expect(html).toContain('1.0.0');
  });

  test('full with null cpu/mem omits system info', () => {
    const data = baseData();
    (data.gateway as any).cpu = null;
    (data.gateway as any).memoryMB = null;
    const html = renderHeader(data, 'full');
    expect(html).not.toContain('CPU');
    expect(html).not.toContain('MEM');
  });
});
