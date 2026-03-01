import { describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context';
import { subscriptionResolvers } from '../subscriptions.resolver';

describe('subscriptionResolvers', () => {
  function makeCtx() {
    return {
      logTailer: { on: vi.fn(), off: vi.fn() },
      gatewayClient: {
        getGatewayStatus: vi.fn().mockResolvedValue({ running: false }),
        getVersion: vi.fn().mockResolvedValue('0.0.0'),
        warmCache: vi.fn().mockResolvedValue(undefined),
      },
      systemInfoService: {
        getSystemMetrics: vi.fn().mockResolvedValue({ cpu: 0, memoryMB: 0 }),
        getUsageCost: vi.fn().mockResolvedValue({ totalCost: 0 }),
        resetMetricsCache: vi.fn(),
        resetCostCache: vi.fn(),
      },
    } as unknown as AppContext;
  }

  it('returns Subscription with logs and dataChanged', () => {
    const ctx = makeCtx();
    const resolvers = subscriptionResolvers(ctx);
    expect(resolvers.Subscription).toBeDefined();
    expect(resolvers.Subscription!.logs).toBeDefined();
    expect(resolvers.Subscription!.dataChanged).toBeDefined();
  });

  it('logs subscribe returns async iterable', () => {
    const ctx = makeCtx();
    const resolvers = subscriptionResolvers(ctx) as unknown as {
      Subscription: Record<string, { subscribe: (...args: unknown[]) => AsyncIterable<unknown> }>;
    };
    const repeater = resolvers.Subscription.logs.subscribe(null, {});
    expect(repeater[Symbol.asyncIterator]).toBeDefined();
  });

  it('logs subscribe pushes entries via logTailer handler', async () => {
    const ctx = makeCtx();
    const resolvers = subscriptionResolvers(ctx) as unknown as {
      Subscription: Record<string, { subscribe: (...args: unknown[]) => AsyncIterable<unknown> }>;
    };
    const repeater = resolvers.Subscription.logs.subscribe(null, {});
    const iter = repeater[Symbol.asyncIterator]();

    // Start reading (this triggers the executor to run)
    const nextPromise = iter.next();

    // Wait for executor to register handler
    await new Promise((r) => setTimeout(r, 50));

    const handler = (ctx.logTailer.on as ReturnType<typeof vi.fn>).mock.calls[0]?.[1];
    expect(handler).toBeTypeOf('function');

    handler({ level: 'INFO', module: 'test', time: '10:00', message: 'hello' });
    const { value } = await nextPromise;
    expect(value.logs.entries[0].message).toBe('hello');
    await iter.return?.();
  });

  it('logs filters by level', async () => {
    const ctx = makeCtx();
    const resolvers = subscriptionResolvers(ctx) as unknown as {
      Subscription: Record<string, { subscribe: (...args: unknown[]) => AsyncIterable<unknown> }>;
    };
    const repeater = resolvers.Subscription.logs.subscribe(null, { filter: { level: 'WARN' } });
    const iter = repeater[Symbol.asyncIterator]();
    const nextPromise = iter.next();
    await new Promise((r) => setTimeout(r, 50));

    const handler = (ctx.logTailer.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
    handler({ level: 'DEBUG', module: 'test', time: '1', message: 'skip' });
    handler({ level: 'WARN', module: 'test', time: '2', message: 'keep' });

    const { value } = await nextPromise;
    expect(value.logs.entries[0].message).toBe('keep');
    await iter.return?.();
  });

  it('logs filters by module', async () => {
    const ctx = makeCtx();
    const resolvers = subscriptionResolvers(ctx) as unknown as {
      Subscription: Record<string, { subscribe: (...args: unknown[]) => AsyncIterable<unknown> }>;
    };
    const repeater = resolvers.Subscription.logs.subscribe(null, { filter: { module: 'gateway' } });
    const iter = repeater[Symbol.asyncIterator]();
    const nextPromise = iter.next();
    await new Promise((r) => setTimeout(r, 50));

    const handler = (ctx.logTailer.on as ReturnType<typeof vi.fn>).mock.calls[0][1];
    handler({ level: 'INFO', module: 'sessions', time: '1', message: 'wrong' });
    handler({ level: 'INFO', module: 'gateway', time: '2', message: 'right' });

    const { value } = await nextPromise;
    expect(value.logs.entries[0].message).toBe('right');
    await iter.return?.();
  });

  it('dataChanged subscribe returns async iterable', () => {
    const ctx = makeCtx();
    const resolvers = subscriptionResolvers(ctx) as unknown as {
      Subscription: Record<string, { subscribe: (...args: unknown[]) => AsyncIterable<unknown> }>;
    };
    const repeater = resolvers.Subscription.dataChanged.subscribe();
    expect(repeater[Symbol.asyncIterator]).toBeDefined();
  });
});
