import { describe, expect, it } from 'vitest';

import { levelToLane, levelToStream, LogRouter } from '../router.js';

describe('levelToStream', () => {
  it('maps info to app', () => expect(levelToStream('info')).toBe('app'));
  it('maps warn to error', () => expect(levelToStream('warn')).toBe('error'));
  it('maps error to error', () => expect(levelToStream('error')).toBe('error'));
  it('maps debug to debug', () => expect(levelToStream('debug')).toBe('debug'));
});

describe('levelToLane', () => {
  it('maps warn to critical', () => expect(levelToLane('warn')).toBe('critical'));
  it('maps error to critical', () => expect(levelToLane('error')).toBe('critical'));
  it('maps info to bestEffort', () => expect(levelToLane('info')).toBe('bestEffort'));
  it('maps debug to bestEffort', () => expect(levelToLane('debug')).toBe('bestEffort'));
});

describe('LogRouter', () => {
  const entry = (
    level: 'debug' | 'info' | 'warn' | 'error',
    byteSize = 100,
    module = 'test-module',
    message = 'test',
  ) => ({
    level,
    module,
    message,
    timestamp: Date.now(),
    byteSize,
  });

  it('accepts entries within capacity', () => {
    const router = new LogRouter();
    const result = router.route(entry('error'));
    expect(result.accepted).toBe(true);
    expect(result.stream).toBe('error');
    expect(result.lane).toBe('critical');
  });

  it('routes configured config noise warnings to noise stream', () => {
    const router = new LogRouter();
    const result = router.route(entry('warn', 100, 'config', 'unknown config key, ignoring'));
    expect(result.accepted).toBe(true);
    expect(result.stream).toBe('noise');
    expect(result.lane).toBe('critical');
  });

  it('routes auth rejected warnings to security stream', () => {
    const router = new LogRouter();
    const result = router.route(entry('warn', 100, 'middleware:auth', 'auth rejected: invalid bearer token'));
    expect(result.accepted).toBe(true);
    expect(result.stream).toBe('security');
    expect(result.lane).toBe('critical');
  });

  it('routes mcp security rejects to security stream', () => {
    const router = new LogRouter();
    const result = router.route(entry('warn', 100, 'mcp', 'security reject: non-local access in no-auth mode'));
    expect(result.accepted).toBe(true);
    expect(result.stream).toBe('security');
    expect(result.lane).toBe('critical');
  });

  it('routes mcp invalid content-type security rejects to security stream', () => {
    const router = new LogRouter();
    const result = router.route(entry('warn', 100, 'mcp', 'security reject: invalid content-type'));
    expect(result.accepted).toBe(true);
    expect(result.stream).toBe('security');
    expect(result.lane).toBe('critical');
  });

  it('routes known noise rules by message prefix', () => {
    const router = new LogRouter();
    const result = router.route(entry('warn', 100, 'config', 'unknown config key, ignoring: tokenRotationEnabled'));
    expect(result.accepted).toBe(true);
    expect(result.stream).toBe('noise');
    expect(result.lane).toBe('critical');
  });

  it('rejects when queue depth is full', () => {
    const router = new LogRouter({ criticalQueueMax: 2, criticalQueueMaxBytes: 1e9 });
    router.route(entry('warn'));
    router.route(entry('error'));
    const third = router.route(entry('warn'));
    expect(third.accepted).toBe(false);
  });

  it('rejects when queue bytes exceeded', () => {
    const router = new LogRouter({ bestEffortQueueMax: 1e6, bestEffortQueueMaxBytes: 200 });
    router.route(entry('info', 150));
    const second = router.route(entry('info', 100));
    expect(second.accepted).toBe(false);
  });

  // P0: Both lanes × both dimensions coverage
  it('rejects critical lane by byte dimension', () => {
    const router = new LogRouter({ criticalQueueMax: 1e6, criticalQueueMaxBytes: 200 });
    router.route(entry('error', 150));
    const second = router.route(entry('warn', 100));
    expect(second.accepted).toBe(false);
    expect(second.lane).toBe('critical');
  });

  it('rejects bestEffort lane by entry dimension', () => {
    const router = new LogRouter({ bestEffortQueueMax: 2, bestEffortQueueMaxBytes: 1e9 });
    router.route(entry('info'));
    router.route(entry('debug'));
    const third = router.route(entry('info'));
    expect(third.accepted).toBe(false);
    expect(third.lane).toBe('bestEffort');
  });

  it('critical lane entry limit rejects at capacity', () => {
    const router = new LogRouter({ criticalQueueMax: 1, criticalQueueMaxBytes: 1e9 });
    router.route(entry('error'));
    const second = router.route(entry('error'));
    expect(second.accepted).toBe(false);
  });

  it('bestEffort lane byte limit rejects at capacity', () => {
    const router = new LogRouter({ bestEffortQueueMax: 1e6, bestEffortQueueMaxBytes: 100 });
    router.route(entry('info', 80));
    const second = router.route(entry('debug', 30));
    expect(second.accepted).toBe(false);
  });

  it('drain reduces queue counters', () => {
    const router = new LogRouter({ criticalQueueMax: 2, criticalQueueMaxBytes: 1e9 });
    router.route(entry('error', 50));
    router.route(entry('error', 50));
    router.drain('critical', 1, 50);
    const stats = router.stats('critical');
    expect(stats.depth).toBe(1);
    expect(stats.bytes).toBe(50);
    // Now should accept again
    expect(router.route(entry('error')).accepted).toBe(true);
  });

  it('stats returns capacity info', () => {
    const router = new LogRouter();
    const stats = router.stats('critical');
    expect(stats.capacity).toBe(10_000);
    expect(stats.capacityBytes).toBe(16 * 1024 * 1024);
  });
});
