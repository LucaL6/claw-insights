import { describe, it, expect, vi } from 'vitest';
import { safe } from '../utils';
import { GraphQLError } from 'graphql';

describe('safe()', () => {
  it('returns the resolved value on success', async () => {
    const result = await safe(async () => ({ name: 'test' }));
    expect(result).toEqual({ name: 'test' });
  });

  it('wraps Error into GraphQLError with INTERNAL_SERVER_ERROR code', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(safe(async () => { throw new Error('db failed'); })).rejects.toThrow(GraphQLError);
      await safe(async () => { throw new Error('db failed'); }).catch((e) => {
        expect(e.message).toBe('db failed');
        expect(e.extensions?.code).toBe('INTERNAL_SERVER_ERROR');
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('handles non-Error throws with generic message', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await safe(async () => { throw 'string error'; }).catch((e) => {
        expect(e.message).toBe('Internal server error');
      });
    } finally {
      consoleSpy.mockRestore();
    }
  });
});
