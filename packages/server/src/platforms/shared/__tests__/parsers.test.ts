import { describe, expect, it } from 'vitest';

import {
  formatUptime,
  parseChannels,
  parseDuOutput,
  parseLaunchctlOutput,
  parsePsOutput,
  parseUsageCostOutput,
} from '../parsers.js';

describe('shared parsers', () => {
  // From system-info.ts
  it('parseLaunchctlOutput extracts PID', () => {
    expect(parseLaunchctlOutput('45678\t0\tai.openclaw.gateway\n')).toBe(45678);
  });

  it('parseLaunchctlOutput returns null when not found', () => {
    expect(parseLaunchctlOutput('123\t0\tcom.example.other\n')).toBeNull();
  });

  it('parsePsOutput parses RSS and CPU', () => {
    expect(parsePsOutput('  524288  12.5')).toEqual({ cpu: 12.5, memoryMB: 512 });
  });

  it('parsePsOutput returns null for empty', () => {
    expect(parsePsOutput('')).toBeNull();
  });

  it('parseDuOutput extracts MB', () => {
    expect(parseDuOutput('256\t/Users/test/.openclaw/')).toBe(256);
  });

  it('parseDuOutput returns 0 for invalid', () => {
    expect(parseDuOutput('error')).toBe(0);
  });

  it('parseUsageCostOutput parses total and today', () => {
    const r = parseUsageCostOutput('Total: $12.50 · 3.2m tokens\nLatest day: 2026-02-18 $1.50 · 0.8m tokens');
    expect(r.totalCost).toBe(12.5);
    expect(r.todayCost).toBe(1.5);
  });

  // From gateway-cli.ts
  it('formatUptime formats HH:MM:SS', () => {
    expect(formatUptime('02:30:15')).toBe('2h 30m');
  });

  it('formatUptime formats DD-HH:MM:SS', () => {
    expect(formatUptime('2-05:30:00')).toBe('2d 5h');
  });

  it('formatUptime formats MM:SS', () => {
    expect(formatUptime('15:30')).toBe('15m');
  });

  it('parseChannels parses channel lines', () => {
    const channels = parseChannels(['Telegram: connected', 'Discord: configured']);
    expect(channels).toHaveLength(2);
    expect(channels[0]).toEqual({ provider: 'telegram', name: 'Telegram', connected: true, latencyMs: null });
  });
});
