import { createChildLogger } from '../logger.js';

const log = createChildLogger('deadline');

export class Deadline {
  private readonly end: number;

  constructor(totalMs: number) {
    this.end = Date.now() + Math.max(0, totalMs);
  }

  remaining(): number {
    return Math.max(0, this.end - Date.now());
  }

  expired(): boolean {
    return Date.now() >= this.end;
  }
}

export async function withDeadline<T>(
  promise: Promise<T>,
  deadline: Deadline,
  TimeoutError: new () => Error,
): Promise<T> {
  const ms = deadline.remaining();
  if (ms <= 0) {
    log.debug('deadline already expired');
    throw new TimeoutError();
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError()), ms);
  });
  // Prevent unhandled rejection if promise wins the race
  timeoutPromise.catch(() => {});

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}
