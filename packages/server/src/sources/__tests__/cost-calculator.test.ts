import type { TallyResult } from 'tokentally';
import { describe, expect, it, vi } from 'vitest';

import { buildTallyCalls, calculateCosts, type SessionTokenData,tallyResultToSummary } from '../cost-calculator';

describe('buildTallyCalls', () => {
  it('converts session data to TallyCall array', () => {
    const sessions: SessionTokenData[] = [
      { key: 's1', model: 'anthropic/claude-opus-4-6', inputTokens: 1000, outputTokens: 500 },
      { key: 's2', model: 'anthropic/claude-opus-4-6', inputTokens: 2000, outputTokens: 800 },
      { key: 's3', model: 'openai/gpt-5.2', inputTokens: 500, outputTokens: 200 },
    ];
    const calls = buildTallyCalls(sessions);
    expect(calls).toHaveLength(3);
    expect(calls[0].model).toBe('anthropic/claude-opus-4-6');
    expect(calls[0].usage?.inputTokens).toBe(1000);
    expect(calls[0].usage?.outputTokens).toBe(500);
    expect(calls[2].model).toBe('openai/gpt-5.2');
  });

  it('returns empty array for no sessions', () => {
    expect(buildTallyCalls([])).toEqual([]);
  });

  it('handles sessions with zero tokens', () => {
    const sessions: SessionTokenData[] = [
      { key: 's1', model: 'unknown', inputTokens: 0, outputTokens: 0 },
    ];
    const calls = buildTallyCalls(sessions);
    expect(calls).toHaveLength(1);
    expect(calls[0].usage?.inputTokens).toBe(0);
  });
});

describe('tallyResultToSummary', () => {
  it('converts TallyResult to CostSummary', () => {
    const result: TallyResult = {
      total: { inputUsd: 0.5, outputUsd: 1.0, totalUsd: 1.5 },
      byModel: {
        'anthropic/claude-opus-4-6': {
          calls: 2,
          usage: { inputTokens: 3000, outputTokens: 1300, reasoningTokens: 0, totalTokens: 4300 },
          cost: { inputUsd: 0.45, outputUsd: 0.91, totalUsd: 1.36 },
        },
        'openai/gpt-5.2': {
          calls: 1,
          usage: { inputTokens: 500, outputTokens: 200, reasoningTokens: 0, totalTokens: 700 },
          cost: { inputUsd: 0.05, outputUsd: 0.09, totalUsd: 0.14 },
        },
      },
    };

    const summary = tallyResultToSummary(result);
    expect(summary.totalUsd).toBe(1.5);
    expect(summary.byModel).toHaveLength(2);
    expect(summary.byModel[0].model).toBe('anthropic/claude-opus-4-6');
    expect(summary.byModel[0].totalUsd).toBe(1.36);
    expect(summary.source).toBe('TOKENTALLY');
  });

  it('handles null costs gracefully', () => {
    const result: TallyResult = {
      total: null,
      byModel: {
        'unknown-model': {
          calls: 1,
          usage: { inputTokens: 100, outputTokens: 50, reasoningTokens: 0, totalTokens: 150 },
          cost: null,
        },
      },
    };

    const summary = tallyResultToSummary(result);
    expect(summary.totalUsd).toBe(0);
    expect(summary.byModel[0].totalUsd).toBe(0);
  });
});

describe('tallyResultToSummary fetchedAt', () => {
  it('produces valid ISO-8601 fetchedAt', () => {
    const result: TallyResult = { total: null, byModel: {} };
    const summary = tallyResultToSummary(result);
    expect(new Date(summary.fetchedAt).toString()).not.toBe('Invalid Date');
    expect(summary.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe('calculateCosts', () => {
  it('returns empty summary for no sessions', async () => {
    const resolver = vi.fn();
    const result = await calculateCosts([], resolver);
    expect(result.totalUsd).toBe(0);
    expect(result.byModel).toEqual([]);
    expect(result.source).toBe('TOKENTALLY');
    expect(resolver).not.toHaveBeenCalled();
  });

  it('calculates costs with mock pricing resolver', async () => {
    const sessions: SessionTokenData[] = [
      { key: 's1', model: 'test-model', inputTokens: 1_000_000, outputTokens: 500_000 },
    ];
    const resolver = vi.fn().mockReturnValue({
      inputUsdPerToken: 0.000003,  // $3/M
      outputUsdPerToken: 0.000015, // $15/M
    });
    const result = await calculateCosts(sessions, resolver);
    expect(result.totalUsd).toBeGreaterThan(0);
    expect(result.byModel).toHaveLength(1);
    expect(result.byModel[0].model).toBe('test-model');
    expect(result.byModel[0].inputUsd).toBeCloseTo(3.0, 1);
    expect(result.byModel[0].outputUsd).toBeCloseTo(7.5, 1);
    expect(result.source).toBe('TOKENTALLY');
  });

  it('handles resolver returning null pricing', async () => {
    const sessions: SessionTokenData[] = [
      { key: 's1', model: 'unknown-model', inputTokens: 1000, outputTokens: 500 },
    ];
    const resolver = vi.fn().mockReturnValue(null);
    const result = await calculateCosts(sessions, resolver);
    expect(result.totalUsd).toBe(0);
    expect(result.byModel[0].totalUsd).toBe(0);
  });
});
