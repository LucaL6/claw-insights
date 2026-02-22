import { describe, it, expect, vi } from 'vitest';
import type { Source, Managed, Processor, Service, WiringRule } from '../types';

describe('Pipeline types', () => {
  it('Source interface accepts EventEmitter-like objects', () => {
    const source: Source = { on: vi.fn(), off: vi.fn(), destroy: vi.fn() };
    source.on('test', () => {});
    expect(source.on).toHaveBeenCalledWith('test', expect.any(Function));
  });

  it('Managed interface has destroy', () => {
    const managed: Managed = { destroy: vi.fn() };
    managed.destroy();
    expect(managed.destroy).toHaveBeenCalled();
  });

  it('Processor accepts a plain function', () => {
    const processor: Processor = vi.fn();
    if (typeof processor === 'function') processor('data');
    expect(processor).toHaveBeenCalledWith('data');
  });

  it('Processor accepts an object with handle method', () => {
    const processor: Processor = { handle: vi.fn() };
    if (typeof processor !== 'function') processor.handle('data');
    expect((processor as any).handle).toHaveBeenCalledWith('data');
  });

  it('Service interface has start/stop', () => {
    const service: Service = { start: vi.fn(), stop: vi.fn() };
    service.start();
    service.stop();
    expect(service.start).toHaveBeenCalled();
    expect(service.stop).toHaveBeenCalled();
  });

  it('WiringRule structure is correct', () => {
    const rule: WiringRule = { source: 'logTailer', event: 'log', targets: ['ingester', 'tracker'] };
    expect(rule.targets).toHaveLength(2);
  });
});
