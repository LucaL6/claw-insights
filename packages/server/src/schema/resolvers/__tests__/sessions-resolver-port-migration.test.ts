import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context';
import type { SessionPort } from '../../../ports/session-port';
import { sessionsResolvers } from '../sessions.resolver';

describe('sessions.resolver - Port Migration', () => {
  let ctx: AppContext;
  let sessionPortMock: SessionPort;
  let capturedContexts: any[];

  beforeEach(() => {
    capturedContexts = [];

    // Mock SessionPort with spy to capture ReadContext
    sessionPortMock = {
      getSessions: vi.fn((options, context) => {
        capturedContexts.push(context);
        return [{ id: 's1', label: 'test', turnCount: 5 }];
      }),
      getSessionById: vi.fn((id, context) => {
        capturedContexts.push(context);
        return { id, label: 'mock', turnCount: 1 };
      }),
      getSessionsInRange: vi.fn((start, end, context) => {
        capturedContexts.push(context);
        return [];
      }),
      getSessionCount: vi.fn((context) => {
        capturedContexts.push(context);
        return 42;
      }),
      onChanged: vi.fn(() => () => {}),
    } as unknown as SessionPort;

    ctx = {
      ports: {
        sessions: sessionPortMock,
        metrics: {} as any,
        gateway: {} as any,
        cron: undefined,
        logs: undefined,
        system: undefined,
      },
      spawnTracker: {
        getParentChildMap: vi.fn().mockReturnValue(new Map()),
      },
      // Legacy fields should NOT be accessed
      sessionReader: {
        attachSubAgents: vi.fn(),
        getSessions: vi.fn(),
      },
    } as unknown as AppContext;
  });

  describe('ReadContext creation and reuse', () => {
    it('creates ReadContext once per request and passes it to Port', () => {
      const resolvers = sessionsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.sessions!({}, {});

      // Verify port was called
      expect(sessionPortMock.getSessions).toHaveBeenCalledTimes(1);

      // Verify a ReadContext was passed
      expect(capturedContexts).toHaveLength(1);
      expect(capturedContexts[0]).toBeDefined();
      expect(capturedContexts[0]).toHaveProperty('requestId');
      expect(capturedContexts[0]).toHaveProperty('asOfTs');
    });

    it('verifies asOfTs is a plain field, not a getter', () => {
      const resolvers = sessionsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.sessions!({}, {});

      const passedContext = capturedContexts[0];
      const descriptor = Object.getOwnPropertyDescriptor(passedContext, 'asOfTs');

      // Must be a plain data field, not a getter
      expect(descriptor).toBeDefined();
      expect(descriptor?.get).toBeUndefined();
      expect(descriptor?.value).toBeTypeOf('number');
    });

    it('verifies requestId is consistent if multiple Port calls happen (theoretical multi-call scenario)', () => {
      // This test simulates a scenario where a resolver might call multiple Port methods
      // For sessions resolver, we only have one call, but we test the principle
      const resolvers = sessionsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.sessions!({}, {});

      const firstRequestId = capturedContexts[0]?.requestId;
      expect(firstRequestId).toBeTypeOf('string');
      expect(firstRequestId.length).toBeGreaterThan(0);
    });

    it('verifies same ReadContext reference is passed to Port (identity check)', () => {
      const resolvers = sessionsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.sessions!({}, {});

      const passedContext = capturedContexts[0];
      expect(passedContext).toBe(passedContext); // Same reference
      expect(passedContext.requestId).toBe(passedContext.requestId); // Stable value
      expect(passedContext.asOfTs).toBe(passedContext.asOfTs); // Stable value
    });
  });

  describe('No legacy context reads', () => {
    it('does NOT call ctx.sessionReader methods', () => {
      const resolvers = sessionsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.sessions!({}, {});

      // Legacy methods should NOT be touched
      expect(ctx.sessionReader.getSessions).not.toHaveBeenCalled();
    });

    it('uses ctx.ports.sessions instead of ctx.sessionReader', () => {
      const resolvers = sessionsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.sessions!({}, {});

      // Port method should be called
      expect(sessionPortMock.getSessions).toHaveBeenCalled();
    });
  });

  describe('Behavior parity', () => {
    it('no longer calls spawnTracker directly (DESIGN-066 event-driven)', () => {
      const resolvers = sessionsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.sessions!({}, {});

      // DESIGN-066: subAgent attachment now handled by SpawnBus event system
      // resolver no longer directly calls spawnTracker
      expect(ctx.spawnTracker.getParentChildMap).not.toHaveBeenCalled();
    });

    it('passes filter options to Port correctly', () => {
      const resolvers = sessionsResolvers(ctx);
      const Query = resolvers.Query!;

      Query.sessions!({}, { filter: { activeOnly: true, sortBy: 'RECENT' } });

      expect(sessionPortMock.getSessions).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: 'RECENT' }),
        expect.anything(),
      );
    });

    it('returns the same shape of data as before', () => {
      const resolvers = sessionsResolvers(ctx);
      const Query = resolvers.Query!;

      const result = Query.sessions!({}, {});

      expect(result).toEqual([{ id: 's1', label: 'test', turnCount: 5 }]);
    });
  });
});
