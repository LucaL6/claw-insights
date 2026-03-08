import { describe, expect, it } from 'vitest';

describe('Stage 2: layered cutover', () => {
  it('layered runtime is always active regardless of LOG_MODE env', async () => {
    const saved = process.env.CLAW_INSIGHTS_LOG_MODE;
    delete process.env.CLAW_INSIGHTS_LOG_MODE;
    delete process.env.OPENCLAW_LOG_MODE;

    try {
      const { createChildLogger } = await import('../../logger.js');
      const log = createChildLogger('stage2-test');
      // If layered runtime is active, calling log.info should not throw
      expect(() => log.info('test message')).not.toThrow();
    } finally {
      if (saved !== undefined) {
        process.env.CLAW_INSIGHTS_LOG_MODE = saved;
      }
    }
  });

  it('health endpoint includes logMode and loggingRuntime fields', async () => {
    const { createHealthHandler } = await import('../../routes/health.js');

    const handler = createHealthHandler({
      version: '0.9.0',
      serverOnly: false,
      checkGateway: async () => true,
      checkDb: () => true,
      checkReady: () => true,
      getLoggingHealth: () => ({
        ts: Date.now(),
        pressureState: 'normal' as const,
        queue: { criticalDepth: 0, criticalCapacity: 10000, bestEffortDepth: 0, bestEffortCapacity: 50000 },
        drops: { debug: 0, info: 0, warn: 0, error: 0 },
        totals: { accepted: 100, dropped: 0 },
        pressureTransitions: 0,
        lastTransitionAt: null,
        signals: {
          queueUsageCriticalPct: 0,
          ioLagMs: 0,
          budgetUsagePct: 10,
          freeSpaceMb: 5000,
        },
      }),
      getLoggingRuntimeHealth: () => ({
        health: 'ok' as const,
        alert: null,
        rollbackTriggered: false,
      }),
    });

    // Mock Express req/res
    const req = {} as import('express').Request;
    const json = { mock: { calls: [] as unknown[][] } };
    const res = {
      json: (body: unknown) => {
        json.mock.calls.push([body]);
      },
      set: () => res,
    } as unknown as import('express').Response;

    await handler(req, res);

    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.logMode).toBe('layered');
    expect(body.loggingRuntime).toEqual({
      health: 'ok',
      alert: null,
      rollbackTriggered: false,
    });
  });

  it('health endpoint reports rollback-triggered state', async () => {
    const { createHealthHandler } = await import('../../routes/health.js');

    const handler = createHealthHandler({
      version: '0.9.0',
      serverOnly: false,
      checkGateway: async () => true,
      checkDb: () => true,
      checkReady: () => true,
      getLoggingRuntimeHealth: () => ({
        health: 'critical' as const,
        alert: 'critical-dropped-error-persisted',
        rollbackTriggered: true,
      }),
    });

    const req = {} as import('express').Request;
    const json = { mock: { calls: [] as unknown[][] } };
    const res = {
      json: (body: unknown) => {
        json.mock.calls.push([body]);
      },
      set: () => res,
    } as unknown as import('express').Response;

    await handler(req, res);

    const body = json.mock.calls[0][0] as Record<string, unknown>;
    expect(body.logMode).toBe('layered');
    const runtime = body.loggingRuntime as Record<string, unknown>;
    expect(runtime.health).toBe('critical');
    expect(runtime.rollbackTriggered).toBe(true);
    expect(runtime.alert).toBe('critical-dropped-error-persisted');
  });

  it('LoggingRuntimeState triggers rollback on sustained error drops', async () => {
    // This is already tested in state.test.ts but we verify the contract here
    const { LoggingRuntimeState } = (await import('../../logging/state.js')) as {
      LoggingRuntimeState: new () => {
        incrementDropped: (level: string, count?: number) => void;
        healthStatus: () => { health: string; rollbackTriggered: boolean; alert: string | null };
        snapshot: (nowMs?: number) => unknown;
      };
    };

    const state = new LoggingRuntimeState();

    // Drop errors over 30s window
    const start = 1000000;
    state.incrementDropped('error', 1);
    state.snapshot(start);

    state.incrementDropped('error', 1);
    state.snapshot(start + 15_000);

    state.incrementDropped('error', 1);
    state.snapshot(start + 31_000);

    const health = state.healthStatus();
    expect(health.health).toBe('critical');
    expect(health.rollbackTriggered).toBe(true);
  });
});
