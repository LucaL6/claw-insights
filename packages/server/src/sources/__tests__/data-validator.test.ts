import { describe, it, expect } from 'bun:test';
import { DataValidator } from '../data-validator';

describe('DataValidator', () => {
  it('should pass when values are within threshold', () => {
    const result = DataValidator.compare(100, 105, 'tokens');
    expect(result.pass).toBe(true);
    expect(result.deviation).toBeLessThan(0.2);
  });

  it('should fail when values exceed 20% deviation', () => {
    const result = DataValidator.compare(100, 150, 'tokens');
    expect(result.pass).toBe(false);
    expect(result.deviation).toBeGreaterThan(0.2);
  });

  it('should handle zero values gracefully', () => {
    const result = DataValidator.compare(0, 0, 'tokens');
    expect(result.pass).toBe(true);
  });

  it('should handle one zero value', () => {
    const result = DataValidator.compare(0, 100, 'tokens');
    expect(result.pass).toBe(false);
  });

  it('should report correct deviation percentage', () => {
    const result = DataValidator.compare(100, 120, 'tokens');
    expect(result.pass).toBe(true); // exactly 20% threshold
    expect(result.deviation).toBeCloseTo(0.1667, 3);
  });

  it('should include metric name in result', () => {
    const result = DataValidator.compare(50, 80, 'daily_tokens_k');
    expect(result.metric).toBe('daily_tokens_k');
    expect(result.sourceA).toBe(50);
    expect(result.sourceB).toBe(80);
  });
});
