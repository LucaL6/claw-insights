import { describe, expect, it } from 'vitest';

import { parseChannels } from '../gateway-cli';

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
