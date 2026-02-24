import { EventEmitter } from 'events';
import { describe, expect, it, vi } from 'vitest';

import { Pipeline } from '../pipeline';
import type { Managed, Service,Source } from '../types';

function mockSource(): Source & EventEmitter {
  const emitter = new EventEmitter();
  (emitter as unknown as Record<string, unknown>).destroy = vi.fn();
  return emitter as Source & EventEmitter;
}

function mockService(): Service {
  return { start: vi.fn(), stop: vi.fn(), destroy: vi.fn() };
}

describe('Pipeline', () => {
  // ── Registration ──────────────────────────────────────────

  it('registers sources, managed, processors, services', () => {
    const managed: Managed = { destroy: vi.fn() };
    const p = new Pipeline()
      .addSource('src', mockSource())
      .addManaged('res', managed)
      .addProcessor('proc', vi.fn())
      .addService('svc', mockService());
    const config = p.getConfig();
    expect(config.sources.size).toBe(1);
    expect(config.managed.size).toBe(1);
    expect(config.processors.size).toBe(1);
    expect(config.services.size).toBe(1);
  });

  // ── Wiring ────────────────────────────────────────────────

  it('wires source events to processor targets', () => {
    const source = mockSource();
    const processor = vi.fn();
    new Pipeline()
      .addSource('src', source)
      .addProcessor('proc', processor)
      .wire('src', 'data', ['proc'])
      .build();
    source.emit('data', 'hello');
    expect(processor).toHaveBeenCalledWith('hello');
  });

  it('wires to multiple processors', () => {
    const source = mockSource();
    const proc1 = vi.fn();
    const proc2 = vi.fn();
    new Pipeline()
      .addSource('src', source)
      .addProcessor('p1', proc1)
      .addProcessor('p2', proc2)
      .wire('src', 'evt', ['p1', 'p2'])
      .build();
    source.emit('evt', 42);
    expect(proc1).toHaveBeenCalledWith(42);
    expect(proc2).toHaveBeenCalledWith(42);
  });

  it('wires to object processor with handle method', () => {
    const source = mockSource();
    const proc = { handle: vi.fn() };
    new Pipeline()
      .addSource('src', source)
      .addProcessor('proc', proc)
      .wire('src', 'data', ['proc'])
      .build();
    source.emit('data', 'test');
    expect(proc.handle).toHaveBeenCalledWith('test');
  });

  // ── Lifecycle ─────────────────────────────────────────────

  it('start() starts all services', () => {
    const svc1 = mockService();
    const svc2 = mockService();
    const p = new Pipeline()
      .addService('s1', svc1)
      .addService('s2', svc2)
      .build();
    p.start();
    expect(svc1.start).toHaveBeenCalled();
    expect(svc2.start).toHaveBeenCalled();
  });

  it('destroy() stops services, destroys sources, and destroys managed', () => {
    const source = mockSource();
    const managed: Managed = { destroy: vi.fn() };
    const svc = mockService();
    const p = new Pipeline()
      .addSource('src', source)
      .addManaged('res', managed)
      .addService('svc', svc)
      .build();
    p.destroy();
    expect(svc.stop).toHaveBeenCalled();
    expect(source.destroy).toHaveBeenCalled();
    expect(managed.destroy).toHaveBeenCalled();
  });

  it('destroy() unbinds wired event handlers', () => {
    const source = mockSource();
    const processor = vi.fn();
    const p = new Pipeline()
      .addSource('src', source)
      .addProcessor('proc', processor)
      .wire('src', 'data', ['proc'])
      .build();

    source.emit('data', 'before');
    expect(processor).toHaveBeenCalledTimes(1);

    p.destroy();

    // After destroy, handler should be unbound
    source.emit('data', 'after');
    expect(processor).toHaveBeenCalledTimes(1); // still 1, not 2
  });

  // ── Validation errors ─────────────────────────────────────

  it('throws on unknown source in wire()', () => {
    expect(() => {
      new Pipeline().addProcessor('p', vi.fn()).wire('missing', 'evt', ['p']);
    }).toThrow(/unknown source/i);
  });

  it('throws on unknown processor in wire()', () => {
    expect(() => {
      new Pipeline().addSource('src', mockSource()).wire('src', 'evt', ['missing']);
    }).toThrow(/unknown processor/i);
  });

  // ── State guards ──────────────────────────────────────────

  it('throws on double build()', () => {
    const p = new Pipeline()
      .addSource('src', mockSource())
      .build();
    expect(() => p.build()).toThrow(/already built/i);
  });

  it('throws on addSource() after build()', () => {
    const p = new Pipeline().build();
    expect(() => p.addSource('src', mockSource())).toThrow(/after build/i);
  });

  it('throws on addProcessor() after build()', () => {
    const p = new Pipeline().build();
    expect(() => p.addProcessor('proc', vi.fn())).toThrow(/after build/i);
  });

  it('throws on addService() after build()', () => {
    const p = new Pipeline().build();
    expect(() => p.addService('svc', mockService())).toThrow(/after build/i);
  });

  it('throws on addManaged() after build()', () => {
    const p = new Pipeline().build();
    expect(() => p.addManaged('res', { destroy: vi.fn() })).toThrow(/after build/i);
  });

  it('throws on wire() after build()', () => {
    const p = new Pipeline()
      .addSource('src', mockSource())
      .addProcessor('proc', vi.fn())
      .build();
    expect(() => p.wire('src', 'data', ['proc'])).toThrow(/after build/i);
  });

  it('throws on start() before build()', () => {
    const p = new Pipeline().addService('svc', mockService());
    expect(() => p.start()).toThrow(/not built/i);
  });

  // ── Lookup ────────────────────────────────────────────────

  it('get() retrieves registered component by name', () => {
    const source = mockSource();
    const p = new Pipeline().addSource('mySource', source).build();
    expect(p.get('mySource')).toBe(source);
  });

  it('get() retrieves managed resource by name', () => {
    const managed: Managed = { destroy: vi.fn() };
    const p = new Pipeline().addManaged('res', managed).build();
    expect(p.get('res')).toBe(managed);
  });
});
