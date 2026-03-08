type MutexOperation = 'rotate' | 'reclaim' | 'sweep';

/**
 * Process-local async mutex for log control critical sections.
 * Operations are serialized regardless of operation type.
 */
export class LogControlMutex {
  private tail: Promise<void> = Promise.resolve();

  async runExclusive<T>(_operation: MutexOperation, fn: () => Promise<T> | T): Promise<T> {
    const previous = this.tail;

    let release: () => void = () => {};
    this.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      return await fn();
    } finally {
      release();
    }
  }
}

export const logControlMutex = new LogControlMutex();
