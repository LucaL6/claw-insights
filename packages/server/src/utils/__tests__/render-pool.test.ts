import { afterEach, describe, expect, it, vi } from 'vitest';

import { RenderPool } from '../render-pool.js';
import { QueueFullError, QueueTimeoutError } from '../snapshot-errors.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('RenderPool', () => {
  it('rejects maxConcurrency < 1', () => {
    expect(() => new RenderPool(0, 5, 5000)).toThrow('maxConcurrency must be >= 1');
    expect(() => new RenderPool(-1, 5, 5000)).toThrow('maxConcurrency must be >= 1');
  });

  it('rejects maxQueueSize < 0', () => {
    expect(() => new RenderPool(1, -1, 5000)).toThrow('maxQueueSize must be >= 0');
  });

  it('allows maxQueueSize = 0 (no queuing)', () => {
    const pool = new RenderPool(1, 0, 5000);
    expect(pool.queueLength).toBe(0);
  });

  it('allows up to maxConcurrency tasks', async () => {
    const pool = new RenderPool(2, 5, 5000);
    let running = 0;
    let maxRunning = 0;
    const task = () =>
      pool.execute(async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise((r) => setTimeout(r, 50));
        running--;
        return 'ok';
      });
    await Promise.all([task(), task(), task(), task()]);
    expect(maxRunning).toBe(2);
  });

  it('queues tasks when at capacity (FIFO)', async () => {
    const pool = new RenderPool(1, 2, 5000);
    const order: number[] = [];
    const slow = pool.execute(async () => {
      await new Promise((r) => setTimeout(r, 100));
      order.push(1);
    });
    const queued2 = pool.execute(async () => {
      order.push(2);
    });
    const queued3 = pool.execute(async () => {
      order.push(3);
    });
    await Promise.all([slow, queued2, queued3]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('rejects when queue is full (only waiting items count)', async () => {
    const pool = new RenderPool(1, 1, 5000);
    const blocker = pool.execute(() => new Promise((r) => setTimeout(r, 200)));
    const queued = pool.execute(async () => 'ok');
    await expect(pool.execute(async () => 'nope')).rejects.toThrow(QueueFullError);
    await blocker;
    await queued;
  });

  it('rejects with QueueTimeoutError when wait exceeds timeout', async () => {
    const pool = new RenderPool(1, 5, 50);
    const blocker = pool.execute(() => new Promise((r) => setTimeout(r, 200)));
    await expect(pool.execute(async () => 'nope')).rejects.toThrow(QueueTimeoutError);
    await blocker;
  });

  it('cleans up timers on successful dequeue', async () => {
    const pool = new RenderPool(1, 5, 5000);
    const blocker = pool.execute(() => new Promise((r) => setTimeout(r, 30)));
    const result = await pool.execute(async () => 'ok');
    expect(result).toBe('ok');
    await blocker;
  });

  it('reports correct concurrency and queueLength', async () => {
    const pool = new RenderPool(1, 5, 5000);
    expect(pool.concurrency).toBe(0);
    expect(pool.queueLength).toBe(0);
    const blocker = pool.execute(() => new Promise((r) => setTimeout(r, 100)));
    await new Promise((r) => setTimeout(r, 5));
    expect(pool.concurrency).toBe(1);
    await blocker;
  });
});
