// src/__tests__/context-ports.test.ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createContext, destroyContext } from '../context.js';
import type { TypedPorts } from '../ports/index.js';
import { createReadContext } from '../ports/shared.js';

describe('Context Ports Integration', () => {
  let ctx: Awaited<ReturnType<typeof createContext>> | null = null;

  afterEach(async () => {
    if (ctx) {
      await destroyContext(ctx);
      ctx = null;
    }
  });

  it('should expose typed ports property', async () => {
    ctx = await createContext();
    expect(ctx).toHaveProperty('ports');
    expect(ctx.ports).toBeDefined();
    expect(typeof ctx.ports).toBe('object');
  });

  it('should provide Phase 1 ports (sessions, metrics, gateway)', async () => {
    ctx = await createContext();
    const { ports } = ctx;

    // Phase 1 ports should exist
    expect(ports.sessions).toBeDefined();
    expect(ports.metrics).toBeDefined();
    expect(ports.gateway).toBeDefined();

    // Sessions port should have expected methods
    expect(typeof ports.sessions.getSessions).toBe('function');
    expect(typeof ports.sessions.getSessionById).toBe('function');
    expect(typeof ports.sessions.onChanged).toBe('function');

    // Metrics port should have expected methods
    expect(typeof ports.metrics.getMetrics).toBe('function');

    // Gateway port should have expected methods
    expect(typeof ports.gateway.getGatewayStatus).toBe('function');
  });

  it('should mark Phase 2 ports as undefined (cron, logs, system)', async () => {
    ctx = await createContext();
    const { ports } = ctx;

    // Phase 2 ports should be undefined
    expect(ports.cron).toBeUndefined();
    expect(ports.logs).toBeUndefined();
    expect(ports.system).toBeUndefined();
  });

  it('should keep legacy fields for backward compatibility', async () => {
    ctx = await createContext();

    // Legacy fields should still exist
    expect(ctx.db).toBeDefined();
    expect(ctx.pipeline).toBeDefined();
    expect(ctx.sessionReader).toBeDefined();
    expect(ctx.cronReader).toBeDefined();
    expect(ctx.aggregator).toBeDefined();
    expect(ctx.gatewayClient).toBeDefined();
  });

  it('should allow calling port methods with ReadContext', async () => {
    ctx = await createContext();
    const readCtx = createReadContext();

    // Avoid flaky external CLI call in full-suite runs
    const gatewaySpy = vi.spyOn(ctx.ports.gateway, 'getGatewayStatus').mockResolvedValueOnce({
      running: true,
      pid: null,
      version: 'test',
      updateAvailable: null,
      uptime: '0s',
      startedAt: null,
      channels: [],
      connectLatencyMs: null,
      latestVersion: null,
      securitySummary: { critical: 0, warn: 0, info: 0 },
      sessionDefaults: null,
    });

    // Should be able to call with ReadContext
    const sessions = ctx.ports.sessions.getSessions(undefined, readCtx);
    expect(Array.isArray(sessions)).toBe(true);

    const metrics = ctx.ports.metrics.getMetrics(undefined, undefined, readCtx);
    expect(metrics).toBeDefined();

    const status = await ctx.ports.gateway.getGatewayStatus(readCtx);
    expect(status).toBeDefined();
    expect(gatewaySpy).toHaveBeenCalledWith(readCtx);
  });

  it('should satisfy TypedPorts interface', async () => {
    ctx = await createContext();

    // Type assertion should compile
    const ports: TypedPorts = ctx.ports;
    expect(ports).toBeDefined();
  });
});

describe('createReadContext', () => {
  it('should generate unique requestId', () => {
    const rc1 = createReadContext();
    const rc2 = createReadContext();

    expect(rc1.requestId).toBeDefined();
    expect(rc2.requestId).toBeDefined();
    expect(rc1.requestId).not.toBe(rc2.requestId);
  });

  it('should freeze asOfTs at creation time', () => {
    const before = Date.now();
    const rc = createReadContext();
    const after = Date.now();

    expect(rc.asOfTs).toBeGreaterThanOrEqual(before);
    expect(rc.asOfTs).toBeLessThanOrEqual(after);

    // asOfTs should be stable
    const firstValue = rc.asOfTs;
    const secondValue = rc.asOfTs;
    expect(firstValue).toBe(secondValue);
  });

  it('should use plain data field for asOfTs, not a getter', () => {
    const rc = createReadContext();
    const descriptor = Object.getOwnPropertyDescriptor(rc, 'asOfTs');

    expect(descriptor).toBeDefined();
    expect(descriptor?.get).toBeUndefined(); // Not a getter
    expect(descriptor?.value).toBeDefined(); // Plain value
    expect(typeof descriptor?.value).toBe('number');
  });

  it('should use plain data field for requestId, not a getter', () => {
    const rc = createReadContext();
    const descriptor = Object.getOwnPropertyDescriptor(rc, 'requestId');

    expect(descriptor).toBeDefined();
    expect(descriptor?.get).toBeUndefined(); // Not a getter
    expect(descriptor?.value).toBeDefined(); // Plain value
    expect(typeof descriptor?.value).toBe('string');
  });
});
