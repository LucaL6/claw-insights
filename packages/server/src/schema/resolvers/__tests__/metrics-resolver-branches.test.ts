import { describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context';
import { metricsResolvers } from '../metrics.resolver';

function mockCtx(): AppContext {
  return {
    aggregator: {
      getMetrics: vi.fn().mockReturnValue({ totalTokensK: 100 }),
    },
    dataValidator: {
      runValidation: vi.fn().mockReturnValue([]),
    },
  } as unknown as AppContext;
}

describe('metricsResolvers branches', () => {
  it('uses TWENTY_FOUR_HOUR when range is null', async () => {
    const ctx = mockCtx();
    const resolvers = metricsResolvers(ctx);
    const metrics = resolvers.Query!.metrics!;

    const result = (metrics as Function)({}, { range: null, date: null });
    expect(ctx.aggregator.getMetrics).toHaveBeenCalledWith(undefined, 'TWENTY_FOUR_HOUR');
    expect(result).toHaveProperty('warnings');
  });

  it('uses provided range when valid', async () => {
    const ctx = mockCtx();
    const resolvers = metricsResolvers(ctx);
    const metrics = resolvers.Query!.metrics!;

    (metrics as Function)({}, { range: 'ONE_HOUR', date: '2026-01-01' });
    expect(ctx.aggregator.getMetrics).toHaveBeenCalledWith('2026-01-01', 'ONE_HOUR');
  });

  it('falls back to TWENTY_FOUR_HOUR for invalid range', async () => {
    const ctx = mockCtx();
    const resolvers = metricsResolvers(ctx);
    const metrics = resolvers.Query!.metrics!;

    (metrics as Function)({}, { range: 'INVALID', date: null });
    expect(ctx.aggregator.getMetrics).toHaveBeenCalledWith(undefined, 'TWENTY_FOUR_HOUR');
  });

  it('includes validation warnings', async () => {
    const ctx = mockCtx();
    (ctx.dataValidator.runValidation as ReturnType<typeof vi.fn>).mockReturnValue([
      { pass: true, message: 'ok' },
      { pass: false, message: 'drift detected' },
    ]);
    const resolvers = metricsResolvers(ctx);
    const metrics = resolvers.Query!.metrics!;

    const result = (metrics as Function)({}, { range: 'ONE_HOUR', date: null }) as { warnings: string[] };
    expect(result.warnings).toEqual(['drift detected']);
  });
});
