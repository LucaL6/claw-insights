import { describe, it, expect } from 'vitest';

describe('useReactiveQuery', () => {
  it('module exports useReactiveQuery function', async () => {
    const mod = await import('../hooks/useReactiveQuery');
    expect(typeof mod.useReactiveQuery).toBe('function');
  });
});
