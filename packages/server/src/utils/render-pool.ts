import { QueueFullError, QueueTimeoutError } from './snapshot-errors.js';

interface QueueEntry {
  resolve: () => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class RenderPool {
  private running = 0;
  private readonly queue: QueueEntry[] = [];

  constructor(
    private readonly maxConcurrency: number,
    private readonly maxQueueSize: number,
    private readonly queueTimeoutMs: number,
  ) {
    if (maxConcurrency < 1) {
      throw new Error('maxConcurrency must be >= 1');
    }
    if (maxQueueSize < 0) {
      throw new Error('maxQueueSize must be >= 0');
    }
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.running < this.maxConcurrency) {
      return this.run(fn);
    }

    if (this.queue.length >= this.maxQueueSize) {
      throw new QueueFullError(this.maxQueueSize);
    }

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.queue.findIndex((e) => e.resolve === resolve);
        if (idx >= 0) {
          this.queue.splice(idx, 1);
        }
        reject(new QueueTimeoutError());
      }, this.queueTimeoutMs);
      timer.unref(); // Don't prevent graceful shutdown

      this.queue.push({ resolve, reject, timer });
    });

    return this.run(fn);
  }

  private async run<T>(fn: () => Promise<T>): Promise<T> {
    this.running++;
    try {
      return await fn();
    } finally {
      this.running--;
      this.dequeue();
    }
  }

  private dequeue(): void {
    const next = this.queue.shift();
    if (next) {
      clearTimeout(next.timer);
      next.resolve();
    }
  }

  get concurrency(): number {
    return this.running;
  }
  get queueLength(): number {
    return this.queue.length;
  }
}
