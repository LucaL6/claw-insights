import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppContext } from '../../../context';
import type { CronPort } from '../../../ports/cron-port';
import { cronResolvers } from '../cron.resolver';

describe('cron.resolver - Port Migration', () => {
  let ctx: AppContext;
  let cronPortMock: CronPort;
  let capturedContexts: any[];

  beforeEach(() => {
    capturedContexts = [];

    // Mock CronPort with spy to capture ReadContext
    cronPortMock = {
      getCronJobs: vi.fn((context) => {
        capturedContexts.push(context);
        return [
          {
            id: 'job1',
            schedule: '0 * * * *',
            enabled: true,
            lastRun: 1709500000000,
            nextRun: 1709503600000,
            description: 'Hourly backup',
          },
        ];
      }),
      getCronJobById: vi.fn(),
      onChanged: vi.fn(() => () => {}),
    } as unknown as CronPort;

    ctx = {
      ports: {
        sessions: {} as any,
        metrics: {} as any,
        gateway: {} as any,
        cron: cronPortMock,
        logs: {} as any,
        system: {} as any,
      },
      // Legacy fields should NOT be accessed
      cronReader: {
        getJobs: vi.fn(),
      },
    } as unknown as AppContext;
  });

  describe('ReadContext creation and reuse', () => {
    it('creates ReadContext once per request and passes it to Port', () => {
      const resolvers = cronResolvers(ctx);
      const Query = resolvers.Query!;

      Query.cronJobs!({}, {});

      // Verify port was called
      expect(cronPortMock.getCronJobs).toHaveBeenCalledTimes(1);

      // Verify a ReadContext was passed
      expect(capturedContexts).toHaveLength(1);
      expect(capturedContexts[0]).toBeDefined();
      expect(capturedContexts[0]).toHaveProperty('requestId');
      expect(capturedContexts[0]).toHaveProperty('asOfTs');
    });

    it('verifies asOfTs is a plain field, not a getter', () => {
      const resolvers = cronResolvers(ctx);
      const Query = resolvers.Query!;

      Query.cronJobs!({}, {});

      const passedContext = capturedContexts[0];
      const descriptor = Object.getOwnPropertyDescriptor(passedContext, 'asOfTs');

      // Must be a plain data field, not a getter
      expect(descriptor).toBeDefined();
      expect(descriptor?.get).toBeUndefined();
      expect(descriptor?.value).toBeTypeOf('number');
    });

    it('verifies requestId is a non-empty string', () => {
      const resolvers = cronResolvers(ctx);
      const Query = resolvers.Query!;

      Query.cronJobs!({}, {});

      const requestId = capturedContexts[0]?.requestId;
      expect(requestId).toBeTypeOf('string');
      expect(requestId.length).toBeGreaterThan(0);
    });
  });

  describe('No legacy context reads', () => {
    it('does NOT call ctx.cronReader methods', () => {
      const resolvers = cronResolvers(ctx);
      const Query = resolvers.Query!;

      Query.cronJobs!({}, {});

      // Legacy methods should NOT be touched
      expect(ctx.cronReader.getJobs).not.toHaveBeenCalled();
    });

    it('uses ctx.ports.cron instead of ctx.cronReader', () => {
      const resolvers = cronResolvers(ctx);
      const Query = resolvers.Query!;

      Query.cronJobs!({}, {});

      // Port method should be called
      expect(cronPortMock.getCronJobs).toHaveBeenCalled();
    });
  });

  describe('Behavior parity - CronEntry to CronJob mapping', () => {
    it('maps CronEntry.lastRun (number) to CronJob.lastRunAt (ISO string)', () => {
      const resolvers = cronResolvers(ctx);
      const Query = resolvers.Query!;

      const result = Query.cronJobs!({}, {}) as any[];

      expect(result[0].lastRunAt).toBe('2024-03-03T21:06:40.000Z');
    });

    it('maps CronEntry.nextRun (number) to CronJob.nextRunAt (ISO string)', () => {
      const resolvers = cronResolvers(ctx);
      const Query = resolvers.Query!;

      const result = Query.cronJobs!({}, {}) as any[];

      expect(result[0].nextRunAt).toBe('2024-03-03T22:06:40.000Z');
    });

    it('maps CronEntry.description to CronJob.name', () => {
      const resolvers = cronResolvers(ctx);
      const Query = resolvers.Query!;

      const result = Query.cronJobs!({}, {}) as any[];

      expect(result[0].name).toBe('Hourly backup');
    });

    it('handles null lastRun correctly', () => {
      (cronPortMock.getCronJobs as any).mockReturnValueOnce([
        {
          id: 'job2',
          schedule: '0 0 * * *',
          enabled: false,
          lastRun: null,
          nextRun: null,
          description: undefined,
        },
      ]);

      const resolvers = cronResolvers(ctx);
      const Query = resolvers.Query!;

      const result = Query.cronJobs!({}, {}) as any[];

      expect(result[0].lastRunAt).toBeNull();
      expect(result[0].nextRunAt).toBeNull();
      expect(result[0].name).toBeNull();
    });

    it('preserves id, schedule, and enabled fields', () => {
      const resolvers = cronResolvers(ctx);
      const Query = resolvers.Query!;

      const result = Query.cronJobs!({}, {}) as any[];

      expect(result[0].id).toBe('job1');
      expect(result[0].schedule).toBe('0 * * * *');
      expect(result[0].enabled).toBe(true);
    });
  });
});
