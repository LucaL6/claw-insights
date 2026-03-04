import { describe, expect, it, vi } from 'vitest';

import { createSpawnBus } from '../spawn-bus.js';

describe('SpawnBus', () => {
  it('emits and receives spawn:link events', () => {
    const bus = createSpawnBus();
    const handler = vi.fn();
    bus.onLink(handler);

    bus.emitLink({ parent: 'main', child: 'sub:123' });

    expect(handler).toHaveBeenCalledWith({ parent: 'main', child: 'sub:123' });
  });

  it('unsubscribe stops receiving events', () => {
    const bus = createSpawnBus();
    const handler = vi.fn();
    const unsub = bus.onLink(handler);

    unsub();
    bus.emitLink({ parent: 'main', child: 'sub:123' });

    expect(handler).not.toHaveBeenCalled();
  });

  it('multiple handlers receive same event', () => {
    const bus = createSpawnBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.onLink(h1);
    bus.onLink(h2);

    bus.emitLink({ parent: 'a', child: 'b' });

    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });
});
