import { describe, expect, it, vi } from 'vitest';

const { mockEvents } = vi.hoisted(() => ({
  mockEvents: [{ id: 1, type: 'error', ts: '2026-01-01T00:00:00Z' }],
}));
vi.mock('../../../db/event-queries', () => ({
  queryEvents: vi.fn().mockReturnValue(mockEvents),
  getEventDensity: vi.fn().mockReturnValue([]),
}));

import type { AppContext } from '../../../context';
import { queryEvents } from '../../../db/event-queries';
import { eventsResolvers } from '../events.resolver';

function mockCtx(): AppContext {
  return { db: {} } as unknown as AppContext;
}

describe('eventsResolvers branches', () => {
  it('passes non-null args as-is (covers ?? branches with truthy values)', async () => {
    const ctx = mockCtx();
    const resolvers = eventsResolvers(ctx);
    const events = resolvers.Query!.events!;

    const result = await (events as Function)(
      {},
      {
        from: '2026-01-01',
        to: '2026-01-02',
        types: ['error'],
        limit: 10,
      },
    );

    expect(queryEvents).toHaveBeenCalledWith(
      {},
      {
        from: '2026-01-01',
        to: '2026-01-02',
        types: ['error'],
        limit: 10,
      },
    );
    expect(result).toEqual(mockEvents);
  });

  it('passes null args as undefined (covers ?? branches with null)', async () => {
    const ctx = mockCtx();
    const resolvers = eventsResolvers(ctx);
    const events = resolvers.Query!.events!;

    const result = await (events as Function)(
      {},
      {
        from: null,
        to: null,
        types: null,
        limit: null,
      },
    );

    expect(queryEvents).toHaveBeenCalledWith(
      {},
      {
        from: undefined,
        to: undefined,
        types: undefined,
        limit: undefined,
      },
    );
    expect(result).toEqual(mockEvents);
  });
});
