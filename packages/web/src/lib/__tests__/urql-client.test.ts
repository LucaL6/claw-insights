import { describe, expect, it, vi } from 'vitest';

vi.mock('graphql-sse', () => ({
  createClient: vi.fn(() => ({
    subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
  })),
}));

describe('urql-client', () => {
  it('exports a client object', async () => {
    const mod = await import('../urql-client');
    expect(mod.client).toBeDefined();
    expect(typeof mod.client).toBe('object');
  });
});
