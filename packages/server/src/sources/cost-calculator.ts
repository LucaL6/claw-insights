import { normalizeTokenUsage, tallyCosts } from 'tokentally';
import type { TallyCall, TallyResult } from 'tokentally';
import type { PricingResolver } from 'tokentally';

// ── Types ───────────────────────────────────────────────────────

export interface SessionTokenData {
  key: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export interface ModelCostBreakdown {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  inputUsd: number;
  outputUsd: number;
  totalUsd: number;
}

export interface CostSummary {
  totalUsd: number;
  inputUsd: number;
  outputUsd: number;
  byModel: ModelCostBreakdown[];
  fetchedAt: string;
  source: 'TOKENTALLY' | 'CLI_FALLBACK';
}

// ── Pure functions ──────────────────────────────────────────────

export function buildTallyCalls(sessions: SessionTokenData[]): TallyCall[] {
  return sessions.map((s) => ({
    model: s.model,
    usage: normalizeTokenUsage({
      prompt_tokens: s.inputTokens,
      completion_tokens: s.outputTokens,
    }),
  }));
}

export function tallyResultToSummary(result: TallyResult): CostSummary {
  const byModel: ModelCostBreakdown[] = Object.entries(result.byModel).map(([model, row]) => ({
    model,
    calls: row.calls,
    inputTokens: row.usage.inputTokens,
    outputTokens: row.usage.outputTokens,
    totalTokens: row.usage.totalTokens ?? row.usage.inputTokens + row.usage.outputTokens,
    inputUsd: row.cost?.inputUsd ?? 0,
    outputUsd: row.cost?.outputUsd ?? 0,
    totalUsd: row.cost?.totalUsd ?? 0,
  }));
  byModel.sort((a, b) => b.totalUsd - a.totalUsd);

  return {
    totalUsd: result.total?.totalUsd ?? 0,
    inputUsd: result.total?.inputUsd ?? 0,
    outputUsd: result.total?.outputUsd ?? 0,
    byModel,
    fetchedAt: new Date().toISOString(),
    source: 'TOKENTALLY',
  };
}

// ── Main function ───────────────────────────────────────────────

export async function calculateCosts(
  sessions: SessionTokenData[],
  resolvePricing: PricingResolver,
): Promise<CostSummary> {
  const calls = buildTallyCalls(sessions);
  if (calls.length === 0) {
    return {
      totalUsd: 0,
      inputUsd: 0,
      outputUsd: 0,
      byModel: [],
      fetchedAt: new Date().toISOString(),
      source: 'TOKENTALLY',
    };
  }

  const result = await tallyCosts({ calls, resolvePricing });
  return tallyResultToSummary(result);
}
