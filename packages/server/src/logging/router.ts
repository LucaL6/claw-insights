import type { LogLane, LogStream, QueueStats } from './types.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function levelToStream(level: LogLevel): LogStream {
  switch (level) {
    case 'info':
      return 'app';
    case 'warn':
    case 'error':
      return 'error';
    case 'debug':
      return 'debug';
  }
}

export function levelToLane(level: LogLevel): LogLane {
  switch (level) {
    case 'warn':
    case 'error':
      return 'critical';
    case 'info':
    case 'debug':
      return 'bestEffort';
  }
}

export interface RouterConfig {
  criticalQueueMax: number;
  criticalQueueMaxBytes: number;
  bestEffortQueueMax: number;
  bestEffortQueueMaxBytes: number;
}

export const DEFAULT_ROUTER_CONFIG: RouterConfig = {
  criticalQueueMax: 10_000,
  criticalQueueMaxBytes: 16 * 1024 * 1024,
  bestEffortQueueMax: 50_000,
  bestEffortQueueMaxBytes: 32 * 1024 * 1024,
};

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  /** Pre-computed byte size of the serialized entry. */
  byteSize: number;
}

export interface RouteResult {
  stream: LogStream;
  lane: LogLane;
  accepted: boolean;
}

export class LogRouter {
  private readonly config: RouterConfig;
  private readonly queues: Record<LogLane, { depth: number; bytes: number }> = {
    critical: { depth: 0, bytes: 0 },
    bestEffort: { depth: 0, bytes: 0 },
  };

  constructor(config: Partial<RouterConfig> = {}) {
    this.config = { ...DEFAULT_ROUTER_CONFIG, ...config };
  }

  route(entry: LogEntry): RouteResult {
    const stream = levelToStream(entry.level);
    const lane = levelToLane(entry.level);
    const q = this.queues[lane];
    const cap = this.laneCapacity(lane);

    if (q.depth >= cap.capacity || q.bytes + entry.byteSize > cap.capacityBytes) {
      return { stream, lane, accepted: false };
    }

    q.depth++;
    q.bytes += entry.byteSize;
    return { stream, lane, accepted: true };
  }

  /** Call after an entry has been written/flushed from the queue. */
  drain(lane: LogLane, count: number, bytes: number): void {
    const q = this.queues[lane];
    q.depth = Math.max(0, q.depth - count);
    q.bytes = Math.max(0, q.bytes - bytes);
  }

  stats(lane: LogLane): QueueStats {
    const q = this.queues[lane];
    const cap = this.laneCapacity(lane);
    return { depth: q.depth, bytes: q.bytes, ...cap };
  }

  private laneCapacity(lane: LogLane): { capacity: number; capacityBytes: number } {
    if (lane === 'critical') {
      return { capacity: this.config.criticalQueueMax, capacityBytes: this.config.criticalQueueMaxBytes };
    }
    return { capacity: this.config.bestEffortQueueMax, capacityBytes: this.config.bestEffortQueueMaxBytes };
  }
}
