import { beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the SSE subscribe handler so we can invoke the sink.error callback
let capturedSseSubscribe: (
  payload: { query: string; variables: Record<string, unknown> },
  sink: { next: (v: unknown) => void; error: (e: unknown) => void; complete: () => void },
) => { unsubscribe: () => void };

vi.mock('graphql-sse', () => ({
  createClient: () => ({
    subscribe: (payload: never, sink: never) => capturedSseSubscribe(payload, sink),
  }),
}));

// Capture forwardSubscription from subscriptionExchange
let capturedForwardSubscription: (operation: { query?: string; variables?: Record<string, unknown> }) => {
  subscribe: (sink: { next: (v: unknown) => void; error: (e: unknown) => void; complete: () => void }) => {
    unsubscribe: () => void;
  };
};

vi.mock('urql', () => ({
  cacheExchange: 'cacheExchange',
  fetchExchange: 'fetchExchange',
  Client: vi.fn(),
  mapExchange: vi.fn(() => 'mapExchange'),
  subscriptionExchange: vi.fn(
    ({ forwardSubscription }: { forwardSubscription: typeof capturedForwardSubscription }) => {
      capturedForwardSubscription = forwardSubscription;
      return 'subscriptionExchange';
    },
  ),
}));

describe('urql-client SSE auth errors', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  async function setup() {
    const mod = await import('../urql-client');
    const forward = capturedForwardSubscription;
    return { mod, forward };
  }

  function subscribeSse(forward: typeof capturedForwardSubscription) {
    const sink = { next: vi.fn(), error: vi.fn(), complete: vi.fn() };
    // Wire up capturedSseSubscribe to forward the sink
    capturedSseSubscribe = (_payload, sseSink) => {
      // Store the sseSink so we can trigger errors
      (subscribeSse as { _sseSink?: typeof sseSink })._sseSink = sseSink;
      return { unsubscribe: vi.fn() };
    };
    const observable = forward({ query: 'subscription {}' });
    observable.subscribe(sink);
    const sseSink = (subscribeSse as { _sseSink?: { error: (e: unknown) => void } })._sseSink!;
    return { sink, sseSink };
  }

  it('SSE error with "401" fires auth callback', async () => {
    const { mod, forward } = await setup();
    const cb = vi.fn();
    mod.setAuthErrorCallback(cb);

    const { sink, sseSink } = subscribeSse(forward);
    sseSink.error(new Error('Server returned 401'));

    expect(cb).toHaveBeenCalledOnce();
    // Error still forwarded to sink
    expect(sink.error).toHaveBeenCalledOnce();
  });

  it('SSE error with "Unauthorized" fires auth callback', async () => {
    const { mod, forward } = await setup();
    const cb = vi.fn();
    mod.setAuthErrorCallback(cb);

    const { sink, sseSink } = subscribeSse(forward);
    sseSink.error(new Error('Unauthorized'));

    expect(cb).toHaveBeenCalledOnce();
    expect(sink.error).toHaveBeenCalledOnce();
  });

  it('SSE non-auth error does not fire callback, error forwarded', async () => {
    const { mod, forward } = await setup();
    const cb = vi.fn();
    mod.setAuthErrorCallback(cb);

    const { sink, sseSink } = subscribeSse(forward);
    const err = new Error('Connection lost');
    sseSink.error(err);

    expect(cb).not.toHaveBeenCalled();
    expect(sink.error).toHaveBeenCalledWith(err);
  });

  it('setAuthErrorCallback resets fired flag', async () => {
    const { mod, forward } = await setup();
    const cb1 = vi.fn();
    mod.setAuthErrorCallback(cb1);

    const { sseSink: sseSink1 } = subscribeSse(forward);
    sseSink1.error(new Error('401'));
    expect(cb1).toHaveBeenCalledOnce();

    // Re-register resets the fired flag
    const cb2 = vi.fn();
    mod.setAuthErrorCallback(cb2);

    const { sseSink: sseSink2 } = subscribeSse(forward);
    sseSink2.error(new Error('401'));
    expect(cb2).toHaveBeenCalledOnce();
  });
});
