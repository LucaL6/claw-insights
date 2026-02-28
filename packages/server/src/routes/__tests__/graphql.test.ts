import { describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../context.js';

vi.mock('../../schema/resolvers/index.js', () => ({
  createResolvers: () => ({}),
}));

describe('registerGraphQL', () => {
  it('registers /graphql middleware on express app', async () => {
    const { registerGraphQL } = await import('../graphql.js');
    const useCalls: unknown[][] = [];
    const app = { use: (...args: unknown[]) => useCalls.push(args) } as any;
    const ctx = {} as unknown as AppContext;

    registerGraphQL(app, ctx);

    expect(useCalls.length).toBe(1);
    expect(useCalls[0][0]).toBe('/graphql');
    expect(typeof useCalls[0][1]).toBe('function');
    expect(typeof useCalls[0][2]).toBe('function');
  });
});
