import { describe, expect,it } from 'vitest';

import { DiagnosticEngine } from '../engine';
import type { DiagnosticRule, SystemSnapshot } from '../types';

const alwaysMatch: DiagnosticRule = {
  id: 'always', severity: 'info', title: 'Always', detail: 'Always matches',
  check: () => true,
};
const neverMatch: DiagnosticRule = {
  id: 'never', severity: 'info', title: 'Never', detail: 'Never matches',
  check: () => false,
};
const snapshot: SystemSnapshot = {
  cpu: 10, memoryMB: 256, diskMB: 50, activeSessions: 1,
  totalTokensK: 100, errorsLast24h: 0, warningsLast24h: 0,
  gatewayRunning: true, recentRestarts: 0, costTodayUsd: 0.5,
};

describe('DiagnosticEngine', () => {
  it('returns matched rules only', () => {
    const engine = new DiagnosticEngine([alwaysMatch, neverMatch]);
    const results = engine.evaluate(snapshot);
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('always');
  });

  it('returns empty array when nothing matches', () => {
    const engine = new DiagnosticEngine([neverMatch]);
    expect(engine.evaluate(snapshot)).toEqual([]);
  });

  it('results include matchedAt as ISO string', () => {
    const engine = new DiagnosticEngine([alwaysMatch]);
    const results = engine.evaluate(snapshot);
    expect(new Date(results[0].matchedAt).toString()).not.toBe('Invalid Date');
  });

  it('preserves severity and detail from rule', () => {
    const rule: DiagnosticRule = {
      id: 'test', severity: 'critical', title: 'Critical Test', detail: 'Detailed text',
      check: () => true,
    };
    const engine = new DiagnosticEngine([rule]);
    const results = engine.evaluate(snapshot);
    expect(results[0].severity).toBe('critical');
    expect(results[0].detail).toBe('Detailed text');
  });

  it('catches rule errors and emits synthetic warning finding', () => {
    const throwingRule: DiagnosticRule = {
      id: 'throws', severity: 'warning', title: 'Throws', detail: '',
      check: () => { throw new Error('boom'); },
    };
    const engine = new DiagnosticEngine([throwingRule, alwaysMatch]);
    const results = engine.evaluate(snapshot);
    // Should not throw — engine catches per-rule
    expect(results).toHaveLength(2);
    expect(results[0].id).toBe('rule-error:throws');
    expect(results[0].severity).toBe('warning');
    expect(results[0].detail).toContain('boom');
    expect(results[1].id).toBe('always');
  });
});
