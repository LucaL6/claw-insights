import { describe, expect,it } from 'vitest';

import { useMetricsValidation } from '../useMetricsValidation';

describe('useMetricsValidation', () => {
  it('returns empty array for empty data', () => {
    expect(useMetricsValidation([])).toEqual([]);
  });

  it('returns empty array when data has non-zero sessions', () => {
    const data = [
      { bucket: 1, sessions: 5, tokensK: 0 },
      { bucket: 2, sessions: 3, tokensK: 0 },
    ];
    expect(useMetricsValidation(data)).toEqual([]);
  });

  it('returns empty array when data has non-zero tokensK', () => {
    const data = [
      { bucket: 1, sessions: 0, tokensK: 10 },
    ];
    expect(useMetricsValidation(data)).toEqual([]);
  });

  it('returns empty array when data has mixed values', () => {
    const data = [
      { bucket: 1, sessions: 0, tokensK: 0 },
      { bucket: 2, sessions: 1, tokensK: 5 },
    ];
    expect(useMetricsValidation(data)).toEqual([]);
  });

  it('warns when all buckets have zero sessions and tokensK', () => {
    const data = [
      { bucket: 1, sessions: 0, tokensK: 0 },
      { bucket: 2, sessions: 0, tokensK: 0 },
    ];
    const warnings = useMetricsValidation(data);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/zero/i);
  });

  it('warns for single bucket with all zeros', () => {
    const data = [{ bucket: 1, sessions: 0, tokensK: 0 }];
    const warnings = useMetricsValidation(data);
    expect(warnings).toHaveLength(1);
  });
});
