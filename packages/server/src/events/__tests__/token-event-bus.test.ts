import { describe, expect, it, vi } from 'vitest';

import { TokenEventBus, type TokenUsageEvent } from '../token-event-bus';

function makeEvent(overrides: Partial<TokenUsageEvent> = {}): TokenUsageEvent {
  return {
    timestamp: '2026-02-27T00:00:00Z',
    sessionKey: 'session-1',
    model: 'claude-opus-4-6',
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 10,
    cacheWriteTokens: 5,
    ...overrides,
  };
}

describe('TokenEventBus', () => {
  it('delivers events to subscribers', () => {
    const bus = new TokenEventBus();
    const handler = vi.fn();
    bus.on(handler);

    const event = makeEvent();
    bus.emit(event);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(event);
  });

  it('supports multiple subscribers', () => {
    const bus = new TokenEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on(h1);
    bus.on(h2);

    bus.emit(makeEvent());

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('unsubscribe removes handler', () => {
    const bus = new TokenEventBus();
    const handler = vi.fn();
    const unsub = bus.on(handler);

    unsub();
    bus.emit(makeEvent());

    expect(handler).not.toHaveBeenCalled();
  });

  it('isolates handler errors — failing handler does not block others', () => {
    const bus = new TokenEventBus();
    const h1 = vi.fn(() => {
      throw new Error('boom');
    });
    const h2 = vi.fn();
    bus.on(h1);
    bus.on(h2);

    bus.emit(makeEvent());

    expect(h1).toHaveBeenCalledOnce();
    expect(h2).toHaveBeenCalledOnce();
  });

  it('destroy removes all handlers', () => {
    const bus = new TokenEventBus();
    const h1 = vi.fn();
    const h2 = vi.fn();
    bus.on(h1);
    bus.on(h2);

    bus.destroy();
    bus.emit(makeEvent());

    expect(h1).not.toHaveBeenCalled();
    expect(h2).not.toHaveBeenCalled();
  });
});
