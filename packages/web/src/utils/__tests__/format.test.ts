import { describe, expect, it } from 'vitest';

import { channelShortName, formatLatency, formatMemoryMB, formatUptime } from '../format';

describe('formatUptime', () => {
  it('returns empty string for null/undefined', () => {
    expect(formatUptime(null)).toBe('');
    expect(formatUptime(undefined)).toBe('');
  });

  it('formats days + hours', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86_400_000 - 3 * 3_600_000).toISOString();
    expect(formatUptime(twoDaysAgo)).toBe('2d 3h');
  });

  it('formats hours + minutes', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000 - 15 * 60_000).toISOString();
    expect(formatUptime(twoHoursAgo)).toBe('2h 15m');
  });

  it('formats minutes only', () => {
    const fiveMinsAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    expect(formatUptime(fiveMinsAgo)).toBe('5m');
  });

  it('returns empty string for future date', () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    expect(formatUptime(future)).toBe('');
  });

  it('returns empty string for invalid date string', () => {
    expect(formatUptime('not-a-date')).toBe('');
  });
});

describe('formatLatency', () => {
  it('returns empty string for null', () => {
    expect(formatLatency(null)).toBe('');
  });

  it('formats milliseconds', () => {
    expect(formatLatency(42)).toBe('42ms');
    expect(formatLatency(999)).toBe('999ms');
  });

  it('formats seconds', () => {
    expect(formatLatency(1000)).toBe('1.0s');
    expect(formatLatency(1500)).toBe('1.5s');
  });
});

describe('channelShortName', () => {
  it('maps known channels', () => {
    expect(channelShortName('Telegram Bot')).toBe('TG');
    expect(channelShortName('slack-workspace')).toBe('Slack');
    expect(channelShortName('Discord Server')).toBe('Discord');
    expect(channelShortName('Signal')).toBe('Signal');
    expect(channelShortName('WhatsApp')).toBe('WA');
    expect(channelShortName('webchat')).toBe('Web');
  });

  it('truncates unknown channels to 6 chars', () => {
    expect(channelShortName('CustomChannel')).toBe('Custom');
  });
});

describe('formatMemoryMB', () => {
  it('shows MB for values below 1024', () => {
    expect(formatMemoryMB(142)).toBe('142 MB');
    expect(formatMemoryMB(0)).toBe('0 MB');
    expect(formatMemoryMB(1023)).toBe('1023 MB');
  });

  it('shows GB with 2 decimals for values >= 1024', () => {
    expect(formatMemoryMB(1024)).toBe('1.00 GB');
    expect(formatMemoryMB(1536)).toBe('1.50 GB');
    expect(formatMemoryMB(2048)).toBe('2.00 GB');
    expect(formatMemoryMB(1234)).toBe('1.21 GB');
  });

  it('rounds MB to nearest integer', () => {
    expect(formatMemoryMB(142.7)).toBe('143 MB');
    expect(formatMemoryMB(512.3)).toBe('512 MB');
  });
});
