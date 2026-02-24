import { describe, expect,it } from 'vitest';

import { diagnosticRules } from '../rules';
import type { SystemSnapshot } from '../types';

const healthy: SystemSnapshot = {
  cpu: 5, memoryMB: 256, diskMB: 50, activeSessions: 3,
  totalTokensK: 100, errorsLast24h: 2, warningsLast24h: 5,
  gatewayRunning: true, recentRestarts: 0, costTodayUsd: 0.5,
};

describe('diagnosticRules', () => {
  it('all rules have unique ids', () => {
    const ids = diagnosticRules.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all rules have non-empty title and detail', () => {
    for (const rule of diagnosticRules) {
      expect(rule.title.length).toBeGreaterThan(0);
      expect(rule.detail.length).toBeGreaterThan(0);
    }
  });

  it('no rules match a healthy system', () => {
    const matched = diagnosticRules.filter((r) => r.check(healthy));
    expect(matched).toEqual([]);
  });

  it('high-cpu triggers above 80%', () => {
    const rule = diagnosticRules.find((r) => r.id === 'high-cpu')!;
    expect(rule.check({ ...healthy, cpu: 81 })).toBe(true);
    expect(rule.check({ ...healthy, cpu: 50 })).toBe(false);
  });

  it('gateway-down triggers when not running', () => {
    const rule = diagnosticRules.find((r) => r.id === 'gateway-down')!;
    expect(rule.check({ ...healthy, gatewayRunning: false })).toBe(true);
    expect(rule.check(healthy)).toBe(false);
  });

  it('cost-spike triggers above $5', () => {
    const rule = diagnosticRules.find((r) => r.id === 'cost-spike')!;
    expect(rule.check({ ...healthy, costTodayUsd: 6 })).toBe(true);
    expect(rule.check({ ...healthy, costTodayUsd: 3 })).toBe(false);
  });

  it('no-active-sessions only triggers when gateway is running', () => {
    const rule = diagnosticRules.find((r) => r.id === 'no-active-sessions')!;
    expect(rule.check({ ...healthy, activeSessions: 0 })).toBe(true);
    expect(rule.check({ ...healthy, activeSessions: 0, gatewayRunning: false })).toBe(false);
  });

  it('gateway-down does not trigger when status is null (unknown)', () => {
    const rule = diagnosticRules.find((r) => r.id === 'gateway-down')!;
    expect(rule.check({ ...healthy, gatewayRunning: null })).toBe(false);
  });

  it('gateway-status-unknown triggers when status is null', () => {
    const rule = diagnosticRules.find((r) => r.id === 'gateway-status-unknown')!;
    expect(rule.check({ ...healthy, gatewayRunning: null })).toBe(true);
    expect(rule.check(healthy)).toBe(false);
  });

  it('warning/critical thresholds are exclusive (no overlap)', () => {
    // Memory: warning 1025-2048, critical >2048
    const memWarn = diagnosticRules.find((r) => r.id === 'high-memory')!;
    const memCrit = diagnosticRules.find((r) => r.id === 'critical-memory')!;
    const atCritical = { ...healthy, memoryMB: 2500 };
    expect(memWarn.check(atCritical)).toBe(false);
    expect(memCrit.check(atCritical)).toBe(true);

    // Cost: warning 5-20, critical >20
    const costWarn = diagnosticRules.find((r) => r.id === 'cost-spike')!;
    const costCrit = diagnosticRules.find((r) => r.id === 'cost-critical')!;
    const highCost = { ...healthy, costTodayUsd: 25 };
    expect(costWarn.check(highCost)).toBe(false);
    expect(costCrit.check(highCost)).toBe(true);

    // Errors: warning 51-200, critical >200
    const errWarn = diagnosticRules.find((r) => r.id === 'error-spike')!;
    const errCrit = diagnosticRules.find((r) => r.id === 'critical-errors')!;
    const manyErrors = { ...healthy, errorsLast24h: 250 };
    expect(errWarn.check(manyErrors)).toBe(false);
    expect(errCrit.check(manyErrors)).toBe(true);
  });
});
