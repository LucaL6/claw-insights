import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const FIXTURE_PATH = resolve(__dirname, '../../../../../../sandbox/fixtures/demo-metrics.json');

interface ModelTokens {
  model: string;
  tokensK: number;
}
interface MetricsBucket {
  bucket: number;
  label: string;
  epochStart: number;
  sessions: number;
  tokensK: number;
  tokensByModel: ModelTokens[];
  errors: number;
  warnings: number;
  gatewayUp: boolean;
  restartEvent: boolean;
}
interface MetricsFixture {
  date: string;
  range: string;
  bucketMinutes: number;
  timezone: string;
  buckets: MetricsBucket[];
  totalTokensK: number;
  rangeTokensK: number;
  totalErrors: number;
  totalWarnings: number;
  uptimePercent: number;
}

function loadMetrics(): MetricsFixture {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf-8'));
}

describe('demo metrics alignment', () => {
  const metrics = loadMetrics();
  const { buckets } = metrics;

  it('should have 12 buckets (6h range, 30min each)', () => {
    expect(buckets.length).toBe(12);
    expect(metrics.bucketMinutes).toBe(30);
    expect(metrics.range).toBe('SIX_HOUR');
  });

  it('should only contain 3 specified models', () => {
    const allModels = new Set(buckets.flatMap((b) => b.tokensByModel.map((t) => t.model)));
    expect(allModels.size).toBe(3);
    expect(allModels).toContain('gpt-5.3-codex');
    expect(allModels).toContain('gpt-5.2-codex');
    expect(allModels).toContain('MiniMax-M2.5');
  });

  it('should have Codex 5.3 as dominant token consumer', () => {
    const totalByModel = new Map<string, number>();
    for (const b of buckets) {
      for (const t of b.tokensByModel) {
        totalByModel.set(t.model, (totalByModel.get(t.model) ?? 0) + t.tokensK);
      }
    }
    const codex53 = totalByModel.get('gpt-5.3-codex') ?? 0;
    const codex52 = totalByModel.get('gpt-5.2-codex') ?? 0;
    const minimax = totalByModel.get('MiniMax-M2.5') ?? 0;
    expect(codex53).toBeGreaterThan(codex52);
    expect(codex53).toBeGreaterThan(minimax);
  });

  it('should align sessions count with total token consumption', () => {
    for (let i = 1; i < buckets.length; i++) {
      const prevSessions = buckets[i - 1].sessions;
      const currSessions = buckets[i].sessions;
      const prevTokens = buckets[i - 1].tokensK;
      const currTokens = buckets[i].tokensK;
      if (currSessions >= prevSessions * 2) {
        expect(currTokens).toBeGreaterThanOrEqual(prevTokens * 0.8);
      }
    }
  });

  it('should have high uptime (99%+) with all buckets up', () => {
    const upCount = buckets.filter((b) => b.gatewayUp).length;
    expect(upCount).toBe(12);
    expect(metrics.uptimePercent).toBeGreaterThanOrEqual(99);
  });

  it('should show a single sharp error spike (middle finger pattern)', () => {
    const errors = buckets.map((b) => b.errors);
    const maxError = Math.max(...errors);
    expect(maxError).toBeGreaterThanOrEqual(10);
    // Only 1 bucket should have the spike (>= 10 errors)
    const spikeBuckets = errors.filter((e) => e >= 10);
    expect(spikeBuckets.length).toBe(1);
    // Neighbors should be much lower
    const maxIdx = errors.indexOf(maxError);
    if (maxIdx > 0) expect(errors[maxIdx - 1]).toBeLessThan(3);
    if (maxIdx < errors.length - 1) expect(errors[maxIdx + 1]).toBeLessThan(3);
  });

  it('should have sparse low errors elsewhere', () => {
    const errors = buckets.map((b) => b.errors);
    const nonSpike = errors.filter((e) => e < 10);
    // Most should be 0
    const zeros = nonSpike.filter((e) => e === 0);
    expect(zeros.length).toBeGreaterThanOrEqual(8);
    // Non-zero non-spike should be low (1-2)
    const lowNonZero = nonSpike.filter((e) => e > 0);
    for (const e of lowNonZero) {
      expect(e).toBeLessThanOrEqual(2);
    }
  });

  it('should have natural session fluctuation (not flat)', () => {
    const sessions = buckets.map((b) => b.sessions);
    const min = Math.min(...sessions);
    const max = Math.max(...sessions);
    expect(max - min).toBeGreaterThanOrEqual(4);
  });

  it('tokensByModel sum should equal bucket tokensK', () => {
    for (const b of buckets) {
      const modelSum = b.tokensByModel.reduce((s, t) => s + t.tokensK, 0);
      expect(Math.abs(modelSum - b.tokensK)).toBeLessThan(1);
    }
  });
});
