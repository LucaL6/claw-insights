import { GraphQLError } from 'graphql';
import { describe, expect, it, vi } from 'vitest';

import { safe } from '../utils';

vi.mock('../../../logger.js', () => ({
  createChildLogger: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('safe()', () => {
  it('returns the resolved value on success', async () => {
    const result = await safe(async () => ({ name: 'test' }));
    expect(result).toEqual({ name: 'test' });
  });

  it('wraps Error into GraphQLError with INTERNAL_SERVER_ERROR code', async () => {
    await expect(safe(async () => { throw new Error('db failed'); })).rejects.toThrow(GraphQLError);
    await safe(async () => { throw new Error('db failed'); }).catch((e) => {
      expect(e.message).toBe('db failed');
      expect(e.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  it('handles non-Error throws with generic message', async () => {
    await safe(async () => { throw 'string error'; }).catch((e) => {
      expect(e.message).toBe('Internal server error');
    });
  });
});
