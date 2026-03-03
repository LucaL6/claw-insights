// src/adapters/__tests__/cron-adapter.test.ts
import type { CronJob } from '@claw-insights/shared';
import { describe, expect, it, vi } from 'vitest';

import { createCronAdapter } from '../cron-adapter.js';
import { testSubscribablePortContract } from './shared/subscribable-port-contract.js';

describe('CronAdapter', () => {
  function createMockReader() {
    const listeners: Array<() => void> = [];
    const jobs: CronJob[] = [];

    return {
      getJobs: vi.fn(() => jobs),
      onChange: vi.fn((fn: () => void) => {
        listeners.push(fn);
      }),
      destroy: vi.fn(),
      // Test helpers
      _jobs: jobs,
      _trigger: () => {
        for (const fn of listeners) {
          fn();
        }
      },
    };
  }

  describe('basic port contract', () => {
    it('should return cron jobs mapped to CronEntry', () => {
      const reader = createMockReader();
      reader._jobs.push({
        id: 'job-1',
        name: 'Daily backup',
        enabled: true,
        schedule: '0 0 * * *',
        lastRunAt: '2026-03-03T00:00:00.000Z',
        lastRunSuccess: true,
        nextRunAt: '2026-03-04T00:00:00.000Z',
      });

      const adapter = createCronAdapter(reader as any);
      const result = adapter.getCronJobs();

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'job-1',
        schedule: '0 0 * * *',
        enabled: true,
        lastRun: new Date('2026-03-03T00:00:00.000Z').getTime(),
        nextRun: new Date('2026-03-04T00:00:00.000Z').getTime(),
        description: 'Daily backup',
      });
      expect(reader.getJobs).toHaveBeenCalledOnce();
    });

    it('should return cron job by id', () => {
      const reader = createMockReader();
      reader._jobs.push({
        id: 'job-2',
        name: null,
        enabled: false,
        schedule: '*/5 * * * *',
        lastRunAt: null,
        lastRunSuccess: null,
        nextRunAt: null,
      });

      const adapter = createCronAdapter(reader as any);
      const result = adapter.getCronJobById('job-2');

      expect(result).toEqual({
        id: 'job-2',
        schedule: '*/5 * * * *',
        enabled: false,
        lastRun: null,
        nextRun: null,
        description: undefined,
      });
    });

    it('should return null for non-existent cron job', () => {
      const reader = createMockReader();
      const adapter = createCronAdapter(reader as any);

      const result = adapter.getCronJobById('missing-job');

      expect(result).toBeNull();
    });
  });

  describe('error mapping', () => {
    it('should map ENOENT to NOT_FOUND', () => {
      const reader = {
        getJobs: vi.fn(() => {
          const err = new Error('File not found') as Error & { code: string };
          err.code = 'ENOENT';
          throw err;
        }),
        onChange: vi.fn(),
        destroy: vi.fn(),
      };

      const adapter = createCronAdapter(reader as any);

      expect(() => adapter.getCronJobs()).toThrow();

      try {
        adapter.getCronJobs();
      } catch (err: any) {
        expect(err.code).toBe('NOT_FOUND');
        expect(err.source).toBe('cron-adapter');
        expect(err.retriable).toBe(false);
      }
    });
  });

  describe('subscription contract', () => {
    testSubscribablePortContract(() => {
      const reader = createMockReader();
      return createCronAdapter(reader as any);
    });

    it('should call subscriber when reader triggers onChange', () => {
      const reader = createMockReader();
      const adapter = createCronAdapter(reader as any);

      const callback = vi.fn();
      adapter.onChanged(callback);

      expect(callback).not.toHaveBeenCalled();

      reader._trigger();

      expect(callback).toHaveBeenCalledOnce();
    });

    it('should attach underlying onChange only once', () => {
      const reader = createMockReader();
      const adapter = createCronAdapter(reader as any);

      adapter.onChanged(vi.fn());
      adapter.onChanged(vi.fn());
      adapter.onChanged(vi.fn());

      expect(reader.onChange).toHaveBeenCalledOnce();
    });
  });

  describe('destroy behavior', () => {
    it('should clear all subscriptions on destroy', () => {
      const reader = createMockReader();
      const adapter = createCronAdapter(reader as any);

      const callback = vi.fn();
      adapter.onChanged(callback);

      adapter.destroy();
      reader._trigger();

      expect(callback).not.toHaveBeenCalled();
    });

    it('should NOT call reader.destroy on adapter destroy', () => {
      const reader = createMockReader();
      const adapter = createCronAdapter(reader as any);

      adapter.destroy();

      expect(reader.destroy).not.toHaveBeenCalled();
    });
  });
});
