import { describe, it, expect } from 'vitest';
import type { DiagnosticRule, SystemSnapshot, DiagnosticResult } from '../types';

describe('Diagnostic types', () => {
  it('DiagnosticRule check receives SystemSnapshot and returns boolean', () => {
    const rule: DiagnosticRule = {
      id: 'test-rule', severity: 'warning', title: 'Test', detail: 'Test detail',
      check: (snap) => snap.cpu > 90,
    };
    const snapshot: SystemSnapshot = {
      cpu: 95, memoryMB: 512, diskMB: 100, activeSessions: 2,
      totalTokensK: 500, errorsLast24h: 0, warningsLast24h: 0,
      gatewayRunning: true, recentRestarts: 0, costTodayUsd: 1.5,
    };
    expect(rule.check(snapshot)).toBe(true);
  });

  it('DiagnosticResult has required fields', () => {
    const result: DiagnosticResult = {
      id: 'test', severity: 'critical', title: 'T', detail: 'D', matchedAt: new Date().toISOString(),
    };
    expect(result.id).toBe('test');
    expect(result.severity).toBe('critical');
  });
});
