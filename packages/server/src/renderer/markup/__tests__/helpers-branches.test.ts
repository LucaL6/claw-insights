import { describe, expect, it } from 'vitest';

import { Sparkline, StatusBadge, Tag, UptimeStrip } from '../helpers.js';

describe('helpers branches', () => {
  it('StatusBadge renders UP when isUp=true', () => {
    const badge = StatusBadge(
      true,
      { emerald: '#10b981', emeraldBg: '#10b98120', red: '#ef4444', redBg: '#ef444420' },
      'en',
    );
    const json = JSON.stringify(badge);
    expect(json).toContain('UP');
    expect(json).toContain('#10b981');
  });

  it('Tag renders correctly', () => {
    const tag = Tag('test', '#bg', '#color', '#border');
    expect(JSON.stringify(tag)).toContain('test');
  });

  it('UptimeStrip renders states with colors', () => {
    const strip = UptimeStrip(['up', 'down', 'degraded'], { up: '#green', down: '#red', degraded: '#yellow' });
    const json = JSON.stringify(strip);
    expect(json).toContain('#green');
    expect(json).toContain('#red');
    expect(json).toContain('#yellow');
  });

  it('Sparkline highlights last bar with higher opacity', () => {
    const node = Sparkline([10, 20, 30], '#blue', 50);
    // Node is a container with children (one per data point)
    const children = (node as any).children ?? (node as any).props?.children;
    expect(children).toHaveLength(3);
    // Verify last bar has higher opacity than others
    const stringified = JSON.stringify(node);
    const parsed = JSON.parse(stringified);
    // Walk the tree to find opacity values
    const opacities: number[] = [];
    const walk = (obj: any) => {
      if (obj && typeof obj === 'object') {
        if ('opacity' in obj) {
          opacities.push(obj.opacity);
        }
        for (const v of Object.values(obj)) {
          walk(v);
        }
      }
    };
    walk(parsed);
    expect(opacities.length).toBeGreaterThanOrEqual(3);
    // Last opacity should be highest
    const lastOpacity = opacities[opacities.length - 1];
    const otherOpacities = opacities.slice(0, -1);
    for (const o of otherOpacities) {
      expect(lastOpacity).toBeGreaterThan(o);
    }
  });
});
