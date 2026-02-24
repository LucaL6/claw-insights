import { describe, expect,it } from 'vitest';

import { parseDuOutput, parseLaunchctlOutput, parsePsOutput, parseUsageCostOutput } from '../system-info';

describe('parseLaunchctlOutput', () => {
  it('extracts PID from launchctl list', () => {
    const output = '123\t0\tcom.example.other\n45678\t0\tai.openclaw.gateway\n';
    expect(parseLaunchctlOutput(output)).toBe(45678);
  });
  it('returns null when service not found', () => {
    expect(parseLaunchctlOutput('123\t0\tcom.example.other\n')).toBeNull();
  });
  it('returns null for empty output', () => {
    expect(parseLaunchctlOutput('')).toBeNull();
  });
  it('returns null when PID is dash', () => {
    expect(parseLaunchctlOutput('-\t0\tai.openclaw.gateway\n')).toBeNull();
  });
});

describe('parsePsOutput', () => {
  it('parses RSS and CPU', () => {
    expect(parsePsOutput('  524288  12.5')).toEqual({ cpu: 12.5, memoryMB: 512 });
  });
  it('returns null for empty output', () => {
    expect(parsePsOutput('')).toBeNull();
  });
  it('returns null for single value', () => {
    expect(parsePsOutput('12345')).toBeNull();
  });
  it('handles zero values', () => {
    expect(parsePsOutput('0 0.0')).toEqual({ cpu: 0, memoryMB: 0 });
  });
});

describe('parseDuOutput', () => {
  it('extracts MB from du output', () => {
    expect(parseDuOutput('256\t/Users/test/.openclaw/')).toBe(256);
  });
  it('returns 0 for empty output', () => {
    expect(parseDuOutput('')).toBe(0);
  });
  it('returns 0 for non-numeric output', () => {
    expect(parseDuOutput('error: no such file')).toBe(0);
  });
});

describe('parseUsageCostOutput', () => {
  it('parses total and today', () => {
    const output = 'Total: $12.50 · 3.2m tokens\nLatest day: 2026-02-18 $1.50 · 0.8m tokens';
    const result = parseUsageCostOutput(output);
    expect(result.totalCost).toBe(12.5);
    expect(result.totalTokensM).toBe(3.2);
    expect(result.todayCost).toBe(1.5);
    expect(result.todayTokensM).toBe(0.8);
  });
  it('returns zeros for empty output', () => {
    const result = parseUsageCostOutput('');
    expect(result.totalCost).toBe(0);
    expect(result.todayCost).toBe(0);
  });
  it('handles partial match (total only)', () => {
    const result = parseUsageCostOutput('Total: $5.00 · 1.0m tokens');
    expect(result.totalCost).toBe(5);
    expect(result.todayCost).toBe(0);
  });
});
