import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock graphql-sse before importing
vi.mock('graphql-sse', () => ({
  createClient: () => ({
    subscribe: vi.fn(),
  }),
}));

// Module-scoped variable to capture the onResult callback without polluting globalThis
let capturedOnResult:
  | ((result: {
      error?: { response?: { status?: number }; graphQLErrors?: Array<{ extensions?: { code?: string } }> };
    }) => void)
  | undefined;

const mockMapExchange = vi.fn(({ onResult }: { onResult: typeof capturedOnResult }) => {
  capturedOnResult = onResult;
  return 'mapExchange';
});

vi.mock('urql', () => ({
  cacheExchange: 'cacheExchange',
  fetchExchange: 'fetchExchange',
  Client: vi.fn(),
  mapExchange: (...args: Parameters<typeof mockMapExchange>) => mockMapExchange(...args),
  subscriptionExchange: vi.fn(() => 'subscriptionExchange'),
}));

describe('urql-client', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  describe('setAuthErrorCallback + isAuthError + fireAuthError', () => {
    it('fires callback on 401 response', async () => {
      const mod = await import('../urql-client');
      const cb = vi.fn();
      mod.setAuthErrorCallback(cb);

      const onResult = capturedOnResult!;
      onResult({ error: { response: { status: 401 } } });
      expect(cb).toHaveBeenCalledOnce();
    });

    it('fires callback on 403 response', async () => {
      const mod = await import('../urql-client');
      const cb = vi.fn();
      mod.setAuthErrorCallback(cb);

      const onResult = capturedOnResult!;
      onResult({ error: { response: { status: 403 } } });
      expect(cb).toHaveBeenCalledOnce();
    });

    it('fires callback on UNAUTHENTICATED graphql error', async () => {
      const mod = await import('../urql-client');
      const cb = vi.fn();
      mod.setAuthErrorCallback(cb);

      const onResult = capturedOnResult!;
      onResult({ error: { graphQLErrors: [{ extensions: { code: 'UNAUTHENTICATED' } }] } });
      expect(cb).toHaveBeenCalledOnce();
    });

    it('does not fire for non-auth errors', async () => {
      const mod = await import('../urql-client');
      const cb = vi.fn();
      mod.setAuthErrorCallback(cb);

      const onResult = capturedOnResult!;
      onResult({ error: { response: { status: 500 } } });
      expect(cb).not.toHaveBeenCalled();
    });

    it('does not fire when error is undefined', async () => {
      const mod = await import('../urql-client');
      const cb = vi.fn();
      mod.setAuthErrorCallback(cb);

      const onResult = capturedOnResult!;
      onResult({});
      expect(cb).not.toHaveBeenCalled();
    });

    it('fires only once (guard)', async () => {
      const mod = await import('../urql-client');
      const cb = vi.fn();
      mod.setAuthErrorCallback(cb);

      const onResult = capturedOnResult!;
      onResult({ error: { response: { status: 401 } } });
      onResult({ error: { response: { status: 401 } } });
      expect(cb).toHaveBeenCalledOnce();
    });

    it('does not fire with no graphQLErrors match', async () => {
      const mod = await import('../urql-client');
      const cb = vi.fn();
      mod.setAuthErrorCallback(cb);

      const onResult = capturedOnResult!;
      onResult({ error: { graphQLErrors: [{ extensions: { code: 'OTHER' } }] } });
      expect(cb).not.toHaveBeenCalled();
    });

    it('handles null callback without throwing', async () => {
      const mod = await import('../urql-client');
      mod.setAuthErrorCallback(null);

      const onResult = capturedOnResult!;
      // Should not throw and should silently handle auth error
      expect(() => onResult({ error: { response: { status: 401 } } })).not.toThrow();
      // Verify the exchange still processes results without error
      expect(() => onResult({ error: { response: { status: 500 } } })).not.toThrow();
      expect(() => onResult({})).not.toThrow();
    });

    it('handles error with no graphQLErrors array', async () => {
      const mod = await import('../urql-client');
      const cb = vi.fn();
      mod.setAuthErrorCallback(cb);

      const onResult = capturedOnResult!;
      onResult({ error: { response: { status: 200 } } });
      expect(cb).not.toHaveBeenCalled();
    });
  });
});
