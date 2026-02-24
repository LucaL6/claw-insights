import { describe, expect,it } from 'vitest';

import { formatUptime } from '../gateway-cli.js';

describe('formatUptime', () => {
  it('parses MM:SS', () => {
    expect(formatUptime('05:30')).toBe('5m');
  });

  it('parses HH:MM:SS', () => {
    expect(formatUptime('02:15:30')).toBe('2h 15m');
  });

  it('parses DD-HH:MM:SS', () => {
    expect(formatUptime('3-04:15:30')).toBe('3d 4h');
  });

  it('handles whitespace', () => {
    expect(formatUptime('  12:33:49\n')).toBe('12h 33m');
  });

  it('handles zero minutes', () => {
    expect(formatUptime('00:45')).toBe('0m');
  });
});
