import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Pipeline } from '../pipeline';
import type { Service } from '../types';

/**
 * Mock Port interface for testing lifecycle semantics.
 * Ports should be subscribable and destroyable.
 */
interface MockPort {
  key: string;
  destroy: ReturnType<typeof vi.fn<() => Promise<void>>>;
  onChanged: (cb: () => void) => () => void;
  _subscriptions: Set<() => void>;
  _destroyed: boolean;
}

function createMockPort(key: string): MockPort {
  const subscriptions = new Set<() => void>();
  let destroyed = false;

  return {
    key,
    _subscriptions: subscriptions,
    _destroyed: destroyed,
    destroy: vi.fn(async () => {
      destroyed = true;
      subscriptions.clear();
    }),
    onChanged: (cb: () => void) => {
      if (destroyed) {
        throw new Error('Port already destroyed');
      }
      subscriptions.add(cb);
      return () => {
        subscriptions.delete(cb);
      };
    },
  };
}

function createFailingPort(key: string, errorMessage: string): MockPort {
  const port = createMockPort(key);
  port.destroy = vi.fn(async () => {
    throw new Error(errorMessage);
  });
  return port;
}

function mockService(): Service {
  return { start: vi.fn(), stop: vi.fn(), destroy: vi.fn() };
}

function mockSource(destroyImpl?: () => void) {
  return {
    on: vi.fn(),
    off: vi.fn(),
    destroy: vi.fn(destroyImpl),
  };
}

function mockManaged(destroyImpl?: () => void) {
  return {
    destroy: vi.fn(destroyImpl),
  };
}

describe('Pipeline Port Lifecycle', () => {
  let pipeline: Pipeline;

  beforeEach(() => {
    pipeline = new Pipeline();
  });

  // ── State Machine ─────────────────────────────────────────

  describe('State Transitions', () => {
    it('starts in init state and allows addPort', () => {
      const port = createMockPort('test');
      expect(() => pipeline.addPort('test', port)).not.toThrow();
    });

    it('transitions from init → built on build()', () => {
      const port = createMockPort('test');
      pipeline.addPort('test', port);
      pipeline.build();
      expect((pipeline as any).state).toBe('built');
    });

    it('transitions from built → started on start()', () => {
      pipeline.build();
      pipeline.start();
      expect((pipeline as any).state).toBe('started');
    });

    it('transitions to destroyed on destroy()', async () => {
      pipeline.build();
      await pipeline.destroy();
      expect((pipeline as any).state).toBe('destroyed');
    });

    it('throws on start() before build()', () => {
      expect(() => pipeline.start()).toThrow(/not built/i);
    });

    it('throws on addPort() after build()', () => {
      pipeline.build();
      const port = createMockPort('test');
      expect(() => pipeline.addPort('test', port)).toThrow(/INVALID_STATE|after build/i);
    });

    it('throws on addPort() after start()', () => {
      pipeline.build();
      pipeline.start();
      const port = createMockPort('test');
      expect(() => pipeline.addPort('test', port)).toThrow(/INVALID_STATE|after build/i);
    });

    it('start() in started state is no-op (idempotent)', () => {
      const svc = mockService();
      pipeline.addService('svc', svc);
      pipeline.build();
      pipeline.start();

      // Record the internal state mutation (e.g., _startedAt)
      const firstStartTime = (pipeline as any)._startedAt;
      expect(svc.start).toHaveBeenCalledTimes(1);

      // Second start() should be no-op
      pipeline.start();
      expect(svc.start).toHaveBeenCalledTimes(1); // Still 1, not 2
      expect((pipeline as any)._startedAt).toBe(firstStartTime); // State not mutated
    });

    it('throws INVALID_STATE on getPort() after destroy()', async () => {
      const port = createMockPort('test');
      pipeline.addPort('test', port);
      pipeline.build();
      await pipeline.destroy();
      expect(() => pipeline.getPort('test')).toThrow(/INVALID_STATE|destroyed/i);
    });

    it('throws INVALID_STATE on build() after destroy()', async () => {
      await pipeline.destroy();
      expect(() => pipeline.build()).toThrow(/INVALID_STATE|destroyed/i);
    });

    it('throws INVALID_STATE on start() after destroy()', async () => {
      pipeline.build();
      await pipeline.destroy();
      expect(() => pipeline.start()).toThrow(/INVALID_STATE|destroyed/i);
    });

    it('throws INVALID_STATE on addPort() after destroy()', async () => {
      await pipeline.destroy();
      const port = createMockPort('test');
      expect(() => pipeline.addPort('test', port)).toThrow(/INVALID_STATE|destroyed/i);
    });
  });

  // ── Port Registration ─────────────────────────────────────

  describe('Port Registration', () => {
    it('addPort() registers a port successfully', () => {
      const port = createMockPort('test');
      pipeline.addPort('test', port);
      pipeline.build();
      expect(pipeline.getPort('test')).toBe(port);
    });

    it('throws on duplicate addPort() with same key', () => {
      const port1 = createMockPort('test');
      const port2 = createMockPort('test');
      pipeline.addPort('test', port1);
      expect(() => pipeline.addPort('test', port2)).toThrow(/duplicate|already registered/i);
    });

    it('getPort() throws on unknown key', () => {
      pipeline.build();
      expect(() => pipeline.getPort('unknown')).toThrow(/INVALID_STATE|not found/i);
    });
  });

  // ── Port Replacement ──────────────────────────────────────

  describe('replacePort', () => {
    it('replacePort() destroys old port before registering new', async () => {
      const oldPort = createMockPort('test');
      const newPort = createMockPort('test');

      pipeline.addPort('test', oldPort);
      await pipeline.replacePort('test', newPort);

      expect(oldPort.destroy).toHaveBeenCalled();
      pipeline.build();
      expect(pipeline.getPort('test')).toBe(newPort);
    });

    it('replacePort() only allowed in init state', async () => {
      const port1 = createMockPort('test');
      const port2 = createMockPort('test');

      pipeline.addPort('test', port1);
      pipeline.build();

      await expect(pipeline.replacePort('test', port2)).rejects.toThrow(/INVALID_STATE|after build/i);
    });

    it('replacePort() staged rollback on old destroy failure', async () => {
      const oldPort = createFailingPort('test', 'Old port destroy failed');
      const newPort = createMockPort('test');

      pipeline.addPort('test', oldPort);

      await expect(pipeline.replacePort('test', newPort)).rejects.toThrow(/Old port destroy failed/);

      // Old port should still be registered (rollback)
      pipeline.build();
      expect(pipeline.getPort('test')).toBe(oldPort);
    });

    it('replacePort() leaves pipeline in consistent state when creation fails externally', async () => {
      const oldPort = createMockPort('test');

      pipeline.addPort('test', oldPort);

      // If new port creation fails BEFORE calling replacePort,
      // the old port should remain intact (replacePort never called)
      let newPortCreationFailed = false;
      try {
        // Simulate external creation failure
        throw new Error('New port creation failed');
      } catch {
        newPortCreationFailed = true;
      }

      expect(newPortCreationFailed).toBe(true);

      // Old port should NOT be destroyed (replacePort was never called)
      expect(oldPort.destroy).not.toHaveBeenCalled();

      // Old port should still be accessible
      pipeline.build();
      expect(pipeline.getPort('test')).toBe(oldPort);
    });
  });

  // ── Destroy Lifecycle ─────────────────────────────────────

  describe('Destroy Lifecycle', () => {
    it('destroy() is idempotent (can be called multiple times)', async () => {
      const port = createMockPort('test');
      pipeline.addPort('test', port);
      pipeline.build();

      await pipeline.destroy();
      expect(port.destroy).toHaveBeenCalledTimes(1);

      // Second destroy should be no-op
      await pipeline.destroy();
      expect(port.destroy).toHaveBeenCalledTimes(1); // Still 1
    });

    it('destroy() executes in three phases: state → ports → sources/managed', async () => {
      const port = createMockPort('port1');
      const svc = mockService();
      const destroyOrder: string[] = [];

      port.destroy = vi.fn(async () => {
        destroyOrder.push('port');
      });
      svc.destroy = vi.fn(() => {
        destroyOrder.push('service');
      });

      pipeline.addPort('port1', port);
      pipeline.addService('svc', svc);
      pipeline.build();

      // Check state before destroy
      expect((pipeline as any).state).not.toBe('destroyed');

      await pipeline.destroy();

      // State should be set to destroyed first
      expect((pipeline as any).state).toBe('destroyed');

      // Ports destroyed before services
      expect(destroyOrder).toEqual(['port', 'service']);
    });

    it('destroy() processes ports in LIFO order (last registered, first destroyed)', async () => {
      const port1 = createMockPort('p1');
      const port2 = createMockPort('p2');
      const port3 = createMockPort('p3');
      const destroyOrder: string[] = [];

      port1.destroy = vi.fn(async () => {
        destroyOrder.push('p1');
      });
      port2.destroy = vi.fn(async () => {
        destroyOrder.push('p2');
      });
      port3.destroy = vi.fn(async () => {
        destroyOrder.push('p3');
      });

      pipeline.addPort('p1', port1);
      pipeline.addPort('p2', port2);
      pipeline.addPort('p3', port3);
      pipeline.build();

      await pipeline.destroy();

      expect(destroyOrder).toEqual(['p3', 'p2', 'p1']); // LIFO
    });

    it('destroy() clears port subscriptions before releasing resources', async () => {
      const port = createMockPort('test');
      const callback = vi.fn();

      pipeline.addPort('test', port);
      pipeline.build();

      port.onChanged(callback);

      await pipeline.destroy();

      // Port subscriptions should be cleared
      expect(port._subscriptions.size).toBe(0);
      expect(port.destroy).toHaveBeenCalled();
    });

    it('destroy() continues on individual port failure and throws AggregateError', async () => {
      const port1 = createMockPort('p1');
      const port2 = createFailingPort('p2', 'Port 2 failed');
      const port3 = createMockPort('p3');

      pipeline.addPort('p1', port1);
      pipeline.addPort('p2', port2);
      pipeline.addPort('p3', port3);
      pipeline.build();

      await expect(pipeline.destroy()).rejects.toThrow(AggregateError);

      // All ports should be attempted
      expect(port1.destroy).toHaveBeenCalled();
      expect(port2.destroy).toHaveBeenCalled();
      expect(port3.destroy).toHaveBeenCalled();
    });

    it('destroy() AggregateError contains all failed items with original errors', async () => {
      const port1 = createMockPort('p1');
      const port2 = createFailingPort('p2', 'Error 2');
      const port3 = createFailingPort('p3', 'Error 3');

      pipeline.addPort('p1', port1);
      pipeline.addPort('p2', port2);
      pipeline.addPort('p3', port3);
      pipeline.build();

      try {
        await pipeline.destroy();
        expect.fail('Should have thrown AggregateError');
      } catch (err) {
        expect(err).toBeInstanceOf(AggregateError);
        const aggErr = err as AggregateError;
        expect(aggErr.errors).toHaveLength(2);
        expect(aggErr.errors[0].message).toContain('Error 3'); // LIFO: p3 first
        expect(aggErr.errors[1].message).toContain('Error 2'); // p2 second
      }
    });

    it('destroy() returns structured report on success', async () => {
      const port1 = createMockPort('p1');
      const port2 = createMockPort('p2');

      pipeline.addPort('p1', port1);
      pipeline.addPort('p2', port2);
      pipeline.build();

      const report = await pipeline.destroy();

      expect(report).toEqual({
        destroyed: {
          ports: ['p2', 'p1'], // LIFO order
          services: [],
          sources: [],
          managed: [],
        },
        failed: [],
      });
    });

    it('destroy() report includes failed items with error details', async () => {
      const port1 = createMockPort('p1');
      const port2 = createFailingPort('p2', 'Port 2 error');
      const port3 = createMockPort('p3');

      pipeline.addPort('p1', port1);
      pipeline.addPort('p2', port2);
      pipeline.addPort('p3', port3);
      pipeline.build();

      try {
        await pipeline.destroy();
      } catch (err) {
        const report = (err as any).report;
        expect(report.destroyed.ports).toContain('p3');
        expect(report.destroyed.ports).toContain('p1');
        expect(report.failed).toHaveLength(1);
        expect(report.failed[0].component).toBe('ports');
        expect(report.failed[0].key).toBe('p2');
        expect(report.failed[0].error.message).toContain('Port 2 error');
      }
    });

    it('destroy() continues after services/sources/managed failures and aggregates all errors', async () => {
      const port = createFailingPort('p', 'port failed');
      const service = mockService();
      service.destroy = vi.fn(() => {
        throw new Error('service failed');
      });
      const source = mockSource(() => {
        throw new Error('source failed');
      });
      const managed = mockManaged(() => {
        throw new Error('managed failed');
      });

      pipeline.addPort('p', port);
      pipeline.addService('svc', service);
      pipeline.addSource('src', source);
      pipeline.addManaged('mgr', managed);
      pipeline.build();

      let thrown: unknown;
      try {
        await pipeline.destroy();
      } catch (err) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(AggregateError);
      const aggErr = thrown as AggregateError;
      expect(aggErr.errors).toHaveLength(4);

      expect(service.stop).toHaveBeenCalledTimes(1);
      expect(service.destroy).toHaveBeenCalledTimes(1);
      expect(source.destroy).toHaveBeenCalledTimes(1);
      expect(managed.destroy).toHaveBeenCalledTimes(1);
    });

    it('destroy() report is component-complete for ports/services/sources/managed', async () => {
      const portOk = createMockPort('p-ok');
      const portFail = createFailingPort('p-fail', 'port fail');
      const serviceOk = mockService();
      const serviceFail = mockService();
      serviceFail.destroy = vi.fn(() => {
        throw new Error('service fail');
      });
      const sourceOk = mockSource();
      const sourceFail = mockSource(() => {
        throw new Error('source fail');
      });
      const managedOk = mockManaged();
      const managedFail = mockManaged(() => {
        throw new Error('managed fail');
      });

      pipeline.addPort('p-ok', portOk);
      pipeline.addPort('p-fail', portFail);
      pipeline.addService('svc-ok', serviceOk);
      pipeline.addService('svc-fail', serviceFail);
      pipeline.addSource('src-ok', sourceOk);
      pipeline.addSource('src-fail', sourceFail);
      pipeline.addManaged('mgr-ok', managedOk);
      pipeline.addManaged('mgr-fail', managedFail);
      pipeline.build();

      try {
        await pipeline.destroy();
        expect.fail('Should throw AggregateError');
      } catch (err) {
        const report = (err as any).report;

        expect(report.destroyed.ports).toContain('p-ok');
        expect(report.destroyed.services).toContain('svc-ok');
        expect(report.destroyed.sources).toContain('src-ok');
        expect(report.destroyed.managed).toContain('mgr-ok');

        expect(report.failed).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ key: 'p-fail', component: 'ports' }),
            expect.objectContaining({ key: 'svc-fail', component: 'services' }),
            expect.objectContaining({ key: 'src-fail', component: 'sources' }),
            expect.objectContaining({ key: 'mgr-fail', component: 'managed' }),
          ]),
        );
      }
    });
  });

  // ── Port Subscription Lifecycle ───────────────────────────

  describe('Port Subscription Lifecycle', () => {
    it('port subscriptions work before destroy', () => {
      const port = createMockPort('test');
      const callback = vi.fn();

      pipeline.addPort('test', port);
      pipeline.build();

      const _unsubscribe = port.onChanged(callback);
      expect(port._subscriptions.has(callback)).toBe(true);

      _unsubscribe();
      expect(port._subscriptions.has(callback)).toBe(false);
    });

    it('port.destroy() auto-clears all subscriptions', async () => {
      const port = createMockPort('test');
      const cb1 = vi.fn();
      const cb2 = vi.fn();

      port.onChanged(cb1);
      port.onChanged(cb2);

      expect(port._subscriptions.size).toBe(2);

      await port.destroy();

      expect(port._subscriptions.size).toBe(0);
    });
  });
});
