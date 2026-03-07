import { describe, expect, it } from 'vitest';

import type { SnapshotData } from '../../../services/snapshot-types.js';
import { DARK } from '../colors.js';
import { renderHeader, resolveLobsterAssetPath } from '../header.js';
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

function collectImages(node: SatoriNode | string | unknown): SatoriNode[] {
  if (!node || typeof node !== 'object') {
    return [];
  }
  const n = node as SatoriNode;
  const results: SatoriNode[] = [];
  if (n.type === 'img') {
    results.push(n);
  }
  const children = n.props?.children;
  if (Array.isArray(children)) {
    for (const child of children) {
      results.push(...collectImages(child));
    }
  }
  return results;
}

function makeData(overrides?: Partial<SnapshotData>): SnapshotData {
  return {
    gateway: { status: 'up', version: '0.9.0', uptime: '2h', cpu: 5, memoryMB: 512 },
    channels: [],
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
    companionDays: 42,
    hostname: 'mini',
    totalConversations: 128,
    ...overrides,
  } as SnapshotData;
}

describe('renderHeader', () => {
  const c = DARK;

  it('renders OpenClaw brand name', () => {
    const tree = renderHeader(makeData(), 'standard', c, 'en');
    const texts = collectText(tree);
    expect(texts).toContain('OpenClaw');
    expect(texts.join(' ')).not.toContain('Claw Insights');
  });

  it('resolves lobster asset path for bundled dist output', () => {
    const distChunkDir = '/repo/packages/server/dist';
    const expectedPath = '/repo/packages/server/assets/openclaw-lobster.svg';
    const resolved = resolveLobsterAssetPath(distChunkDir, (candidate) => candidate === expectedPath);
    expect(resolved).toBe(expectedPath);
  });

  it('uses the lobster asset styling in snapshot header icon with fixed 32x32 size', () => {
    const tree = renderHeader(makeData(), 'standard', c, 'en');
    const images = collectImages(tree);
    const lobsterImage = images.find((img) =>
      typeof img.props?.src === 'string' ? img.props.src.startsWith('data:image/svg+xml;base64,') : false,
    );
    expect(lobsterImage).toBeDefined();
    expect(lobsterImage?.props?.width).toBe(32);
    expect(lobsterImage?.props?.height).toBe(32);

    const encoded = String(lobsterImage?.props?.src).replace('data:image/svg+xml;base64,', '');
    const decoded = Buffer.from(encoded, 'base64').toString('utf8');
    expect(decoded).toContain('lobster-gradient');
  });

  it('shows Online when gateway is up', () => {
    const tree = renderHeader(makeData(), 'standard', c, 'en');
    const texts = collectText(tree);
    expect(texts).toContain('Online');
  });

  it('shows Offline when gateway is down', () => {
    const tree = renderHeader(
      makeData({ gateway: { status: 'down', version: '0.9.0', uptime: '0', cpu: 0, memoryMB: 0 } }),
      'standard',
      c,
      'en',
    );
    const texts = collectText(tree);
    expect(texts).toContain('Offline');
  });

  it('shows English subtitle with expanded range', () => {
    const tree = renderHeader(makeData(), 'standard', c, 'en');
    const texts = collectText(tree);
    expect(texts.join(' ')).toContain('Last 6 Hours');
  });

  it('shows Chinese subtitle', () => {
    const tree = renderHeader(makeData(), 'standard', c, 'zh');
    const texts = collectText(tree);
    expect(texts.join(' ')).toContain('最近 6 小时');
  });

  it('shows Chinese Online status', () => {
    const tree = renderHeader(makeData(), 'standard', c, 'zh');
    const texts = collectText(tree);
    expect(texts).toContain('在线');
  });

  it('shows Chinese Offline status', () => {
    const tree = renderHeader(
      makeData({ gateway: { status: 'down', version: '0.9.0', uptime: '0', cpu: 0, memoryMB: 0 } }),
      'standard',
      c,
      'zh',
    );
    const texts = collectText(tree);
    expect(texts).toContain('离线');
  });
});
