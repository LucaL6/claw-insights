import { describe, test, expect } from 'vitest';
import { renderTemplate } from '../template-renderer';
import type { SnapshotData } from '../data-service';

const mockData: SnapshotData = {
  gateway: { status: 'up', version: '2026.2.12', uptime: '2d', cpu: 8, memoryMB: 1135 },
  channels: [{ name: 'TG', provider: 'telegram', connected: true, latencyMs: 45 }],
  timestamp: '2026-02-17T12:57:00Z',
  range: '24h',
  summary: { activeSessions: 28, totalSessions: 28, tokens: 5435800, tokensDisplay: '5435.8k', errors: 148, warnings: 2, uptimePercent: 100 },
  sparklines: { sessions: [45,65,80,100,70], tokens: [30,50,90,100,60], errors: [80,40,10,35,90], uptime: ['up','up','degraded','up','up'] },
};

describe('renderTemplate', () => {
  test('renders mobile-compact with data injected', () => {
    const html = renderTemplate('mobile-compact', mockData, { theme: 'dark', lang: 'en' });
    expect(html).toContain('Claw Insights');
    expect(html).toContain('"status":"up"');
    expect(html).not.toContain('__SNAPSHOT_DATA_PLACEHOLDER__');
  });

  test('renders mobile-standard', () => {
    const html = renderTemplate('mobile-standard', mockData, { theme: 'dark', lang: 'en' });
    expect(html).toContain('Claw Insights');
    expect(html).toContain('"version":"2026.2.12"');
  });

  test('renders mobile-full', () => {
    const html = renderTemplate('mobile-full', mockData, { theme: 'dark', lang: 'en' });
    expect(html).toContain('Claw Insights');
    expect(html).toContain('"errors":148');
  });

  test('injects theme and lang', () => {
    const html = renderTemplate('mobile-compact', mockData, { theme: 'light', lang: 'zh' });
    expect(html).toContain('lang="zh"');
    expect(html).toContain('data-theme="light"');
  });
});
