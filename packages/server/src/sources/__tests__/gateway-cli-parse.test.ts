import { describe, it, expect } from 'vitest';
import { parseChannels, parseStatus } from '../gateway-cli';

describe('parseChannels', () => {
  it('parses configured channels', () => {
    const result = parseChannels(['Telegram: configured', 'Discord: connected']);
    expect(result).toEqual([
      { provider: 'telegram', name: 'Telegram', connected: true, latencyMs: null },
      { provider: 'discord', name: 'Discord', connected: true, latencyMs: null },
    ]);
  });

  it('handles disconnected channel', () => {
    const result = parseChannels(['Slack: disconnected']);
    expect(result).toEqual([{ provider: 'slack', name: 'Slack', connected: false, latencyMs: null }]);
  });

  it('returns empty for empty input', () => {
    expect(parseChannels([])).toEqual([]);
  });

  it('skips non-matching lines', () => {
    expect(parseChannels(['some random text', ''])).toEqual([]);
  });
});

describe('parseStatus', () => {
  const MOCK_JSON = JSON.stringify({
    gateway: { reachable: true, connectLatencyMs: 42 },
    gatewayService: { runtimeShort: 'running, pid 12345' },
    channelSummary: ['Telegram: configured'],
    update: { latestVersion: '2026.3.0' },
    securityAudit: { summary: { critical: 0, warn: 1, info: 3 } },
    sessions: { defaults: { model: 'claude-opus-4-6', contextTokens: 200000 } },
  });

  it('parses valid JSON status', () => {
    const result = parseStatus(MOCK_JSON, '2026.2.12');
    expect(result.running).toBe(true);
    expect(result.pid).toBe(12345);
    expect(result.version).toBe('2026.2.12');
    expect(result.connectLatencyMs).toBe(42);
    expect(result.latestVersion).toBe('2026.3.0');
    expect(result.updateAvailable).toBe('2026.3.0');
    expect(result.channels).toHaveLength(1);
    expect(result.channels[0].provider).toBe('telegram');
    expect(result.securitySummary).toEqual({ critical: 0, warn: 1, info: 3 });
    expect(result.sessionDefaults).toEqual({ model: 'claude-opus-4-6', contextTokens: 200000 });
  });

  it('returns safe defaults for invalid JSON', () => {
    const result = parseStatus('not json', 'unknown');
    expect(result.running).toBe(false);
    expect(result.pid).toBeNull();
    expect(result.channels).toEqual([]);
    expect(result.connectLatencyMs).toBeNull();
  });

  it('returns safe defaults for empty JSON', () => {
    const result = parseStatus('{}', '1.0');
    expect(result.running).toBe(false);
    expect(result.version).toBe('1.0');
  });

  it('updateAvailable is null when versions match', () => {
    const json = JSON.stringify({
      gateway: { reachable: true },
      update: { latestVersion: '2026.2.12' },
    });
    const result = parseStatus(json, '2026.2.12');
    expect(result.updateAvailable).toBeNull();
  });
});
