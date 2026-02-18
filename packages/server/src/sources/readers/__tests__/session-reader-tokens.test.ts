import { describe, it, expect } from 'vitest';
import { SessionReader } from '../session-reader';

describe('SessionReader token methods', () => {
  it('getTokensByModel returns a Map<string, number>', () => {
    const reader = new SessionReader();
    const result = reader.getTokensByModel();
    expect(result).toBeInstanceOf(Map);
    for (const [model, tokens] of result) {
      expect(typeof model).toBe('string');
      expect(typeof tokens).toBe('number');
      expect(tokens).toBeGreaterThanOrEqual(0);
    }
  });

  it('getTotalTokensK returns a number >= 0', () => {
    const reader = new SessionReader();
    const result = reader.getTotalTokensK();
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThanOrEqual(0);
  });

  it('getTotalTokensK equals sum of getTokensByModel values / 1000', () => {
    const reader = new SessionReader();
    const byModel = reader.getTokensByModel();
    const sumFromModel = [...byModel.values()].reduce((s, v) => s + v, 0) / 1000;
    const total = reader.getTotalTokensK();
    expect(Math.abs(total - sumFromModel)).toBeLessThan(0.01);
  });

  it('getTokensByModel includes sub-agent tokens (not affected by dedup)', () => {
    const reader = new SessionReader();
    const sessionsTotal = reader.getSessions().reduce((s, sess) => s + sess.totalTokens, 0) / 1000;
    const fullTotal = reader.getTotalTokensK();
    expect(fullTotal).toBeGreaterThanOrEqual(sessionsTotal);
  });
});
