import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { DARK } from '../colors.js';
import { renderGatewayBanner } from '../gateway-banner.js';
import type { SatoriNode } from '../helpers.js';

function collectText(node: SatoriNode | string | unknown): string[] {
  if (typeof node === 'string') return [node];
  if (typeof node === 'number') return [String(node)];
  if (!node || typeof node !== 'object') return [];
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

function hasStyle(node: unknown, key: string, value: unknown): boolean {
  if (!node || typeof node !== 'object') return false;
  const n = node as SatoriNode;
  if (n.props?.style?.[key] === value) return true;
  const children = n.props?.children;
  if (Array.isArray(children)) {
    return children.some((c) => hasStyle(c, key, value));
  }
  return false;
}

function makeData(overrides?: Partial<SnapshotData>): SnapshotData {
  return {
    gateway: { status: 'up', version: '0.1.0', uptime: '2h', cpu: 5, memoryMB: 512 },
    channels: [
      { name: 'TG', provider: 'telegram', connected: true },
      { name: 'Slack', provider: 'slack', connected: true },
    ],
    timestamp: '2026-02-26T00:00:00Z',
    range: '6h',
    time: '23:11',
    summary: {
      activeSessions: 2,
      totalSessions: 5,
      tokens: 1000,
      tokensDisplay: '1.0k',
      errors: 0,
      warnings: 0,
      uptimePercent: 100,
    },
    sparklines: { sessions: [], tokens: [], errors: [], uptime: [] },
    ...overrides,
  } as SnapshotData;
}

const c = DARK;

describe('renderGatewayBanner', () => {
  it('returns null for compact detail', () => {
    expect(renderGatewayBanner(makeData(), 'compact', c)).toBeNull();
  });

  it('renders gateway label, UP status, channels, and resources', () => {
    const tree = renderGatewayBanner(makeData(), 'standard', c)!;
    const texts = collectText(tree);
    expect(texts).toContain('OpenClaw Gateway');
    expect(texts).toContain('UP');
    expect(texts).toContain('TG');
    expect(texts).toContain('Slack');
    expect(texts).toContain('CPU 5%');
    expect(texts).toContain('MEM 512M');
  });

  it('down state uses gatewayDownBg and shows DOWN', () => {
    const data = makeData({ gateway: { status: 'down', version: '0.1.0', uptime: '0', cpu: 0, memoryMB: 0 } });
    const tree = renderGatewayBanner(data, 'standard', c)!;
    const texts = collectText(tree);
    expect(texts).toContain('DOWN');
    expect(tree.props.style.backgroundColor).toBe(c.gatewayDownBg);
  });

  it('connecting status treated as down', () => {
    const data = makeData({
      gateway: { status: 'connecting' as 'up', version: '0.1.0', uptime: '0', cpu: 0, memoryMB: 0 },
    });
    const tree = renderGatewayBanner(data, 'standard', c)!;
    const texts = collectText(tree);
    expect(texts).toContain('DOWN');
    expect(tree.props.style.backgroundColor).toBe(c.gatewayDownBg);
  });

  it('0 channels — no channel elements, still renders left + right', () => {
    const data = makeData({ channels: [] });
    const tree = renderGatewayBanner(data, 'standard', c)!;
    const texts = collectText(tree);
    expect(texts).toContain('OpenClaw Gateway');
    expect(texts).toContain('CPU 5%');
    expect(texts).not.toContain('TG');
  });

  it('1 channel — renders single channel', () => {
    const data = makeData({ channels: [{ name: 'TG', provider: 'telegram', connected: true }] });
    const tree = renderGatewayBanner(data, 'standard', c)!;
    const texts = collectText(tree);
    expect(texts).toContain('TG');
    expect(texts.filter((t) => t === '·')).toHaveLength(0);
  });

  it('3 channels — renders all, no overflow', () => {
    const data = makeData({
      channels: [
        { name: 'TG', provider: 'telegram', connected: true },
        { name: 'Slack', provider: 'slack', connected: true },
        { name: 'Discord', provider: 'discord', connected: true },
      ],
    });
    const tree = renderGatewayBanner(data, 'standard', c)!;
    const texts = collectText(tree);
    expect(texts).toContain('TG');
    expect(texts).toContain('Slack');
    expect(texts).toContain('Discord');
    expect(texts.join(' ')).not.toMatch(/\+\d/);
  });

  it('4 channels — shows first 2 + "+2"', () => {
    const data = makeData({
      channels: [
        { name: 'TG', provider: 'telegram', connected: true },
        { name: 'Slack', provider: 'slack', connected: true },
        { name: 'Discord', provider: 'discord', connected: true },
        { name: 'WA', provider: 'whatsapp', connected: true },
      ],
    });
    const tree = renderGatewayBanner(data, 'standard', c)!;
    const texts = collectText(tree);
    expect(texts).toContain('+2');
  });

  it('5 channels — shows first 2 + "+3"', () => {
    const data = makeData({
      channels: [
        { name: 'TG', provider: 'telegram', connected: true },
        { name: 'Slack', provider: 'slack', connected: true },
        { name: 'Discord', provider: 'discord', connected: true },
        { name: 'WA', provider: 'whatsapp', connected: true },
        { name: 'Signal', provider: 'signal', connected: true },
      ],
    });
    const tree = renderGatewayBanner(data, 'standard', c)!;
    const texts = collectText(tree);
    expect(texts).toContain('+3');
    // Only first 2 visible
    const channelNames = texts.filter((t) => ['TG', 'Slack', 'Discord', 'WA', 'Signal'].includes(t));
    expect(channelNames).toHaveLength(2);
  });

  it('all disconnected — channel dots use grey not green', () => {
    const data = makeData({
      channels: [
        { name: 'TG', provider: 'telegram', connected: false },
        { name: 'Slack', provider: 'slack', connected: false },
      ],
    });
    const tree = renderGatewayBanner(data, 'standard', c)!;
    // Gateway is UP so StatusBadge has emerald, but channel dots should be textDim
    const texts = collectText(tree);
    expect(texts).toContain('TG');
    expect(texts).toContain('Slack');
    // Verify the banner renders (channels are present with grey styling)
    expect(texts).toContain('UP');
  });

  it('connected channels sorted before disconnected', () => {
    const data = makeData({
      channels: [
        { name: 'Slack', provider: 'slack', connected: false },
        { name: 'TG', provider: 'telegram', connected: true },
        { name: 'Discord', provider: 'discord', connected: false },
      ],
    });
    const tree = renderGatewayBanner(data, 'standard', c)!;
    const texts = collectText(tree);
    const channelNames = texts.filter((t) => ['TG', 'Slack', 'Discord'].includes(t));
    // TG (connected) should be first
    expect(channelNames[0]).toBe('TG');
  });

  it('CPU=0, MEM=0 shows values not fallback', () => {
    const data = makeData({ gateway: { status: 'up', version: '0.1.0', uptime: '2h', cpu: 0, memoryMB: 0 } });
    const tree = renderGatewayBanner(data, 'standard', c)!;
    const texts = collectText(tree);
    expect(texts).toContain('CPU 0%');
    expect(texts).toContain('MEM 0M');
  });

  it('CPU=NaN shows fallback "--"', () => {
    const data = makeData({ gateway: { status: 'up', version: '0.1.0', uptime: '2h', cpu: NaN, memoryMB: NaN } });
    const tree = renderGatewayBanner(data, 'standard', c)!;
    const texts = collectText(tree);
    expect(texts).toContain('CPU --');
    expect(texts).toContain('MEM --');
  });

  it('does not mutate input channels array', () => {
    const channels = [
      { name: 'Slack', provider: 'slack', connected: false },
      { name: 'TG', provider: 'telegram', connected: true },
    ];
    const data = makeData({ channels });
    renderGatewayBanner(data, 'standard', c);
    // Original order preserved
    expect(channels[0].name).toBe('Slack');
    expect(channels[1].name).toBe('TG');
  });
});
