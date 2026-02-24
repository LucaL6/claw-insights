import { describe, expect,it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { renderCharts } from '../charts.js';
import { DARK } from '../colors.js';
import { renderErrors } from '../errors.js';
import { Sparkline,StatusBadge } from '../helpers.js';

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
