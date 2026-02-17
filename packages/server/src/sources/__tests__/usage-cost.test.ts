import { describe, it, expect } from 'vitest';
import { parseUsageCostOutput } from '../usage-cost';

describe('usage-cost parser', () => {
  it('should parse standard output', () => {
    const output = 'Usage cost (30 days)\nTotal: $816.40 · 945.0m tokens\nMissing entries: 20\nLatest day: 2026-02-15 · $70.93 · 97.1m tokens';
    const result = parseUsageCostOutput(output);
    expect(result.totalCost).toBeCloseTo(816.40);
    expect(result.totalTokensM).toBeCloseTo(945.0);
    expect(result.todayCost).toBeCloseTo(70.93);
    expect(result.todayTokensM).toBeCloseTo(97.1);
  });

  it('should handle empty output gracefully', () => {
    const result = parseUsageCostOutput('');
    expect(result.totalCost).toBe(0);
    expect(result.todayCost).toBe(0);
  });

  it('should handle missing "Latest day" line', () => {
    const output = 'Usage cost (30 days)\nTotal: $100.00 · 200.0m tokens';
    const result = parseUsageCostOutput(output);
    expect(result.totalCost).toBeCloseTo(100.0);
    expect(result.todayCost).toBe(0);
  });
});
