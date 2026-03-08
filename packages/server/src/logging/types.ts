export type LogStream = 'app' | 'error' | 'debug';
export type LogLane = 'critical' | 'bestEffort';

export interface QueueStats {
  depth: number;
  bytes: number;
  capacity: number;
  capacityBytes: number;
}

export const PRESSURE_STATES = ['normal', 'pressure', 'emergency'] as const;

export type PressureState = (typeof PRESSURE_STATES)[number];

export interface DropCounters {
  debug: number;
  info: number;
  warn: number;
  error: number;
}

export interface QueueMetrics {
  criticalDepth: number;
  criticalCapacity: number;
  bestEffortDepth: number;
  bestEffortCapacity: number;
}

export interface PressureSignals {
  queueUsageCriticalPct: number;
  ioLagMs: number;
  budgetUsagePct: number;
  freeSpaceMb: number;
  tailRepairCount?: number;
  firstAppendAfterRepair?: boolean;
  recoveredWithinDurabilityWindowMs?: number;
}

export interface LoggingHealthSnapshot {
  ts: number;
  pressureState: PressureState;
  queue: QueueMetrics;
  drops: DropCounters;
  totals: {
    accepted: number;
    dropped: number;
  };
  pressureTransitions: number;
  lastTransitionAt: number | null;
  signals: PressureSignals;
}
