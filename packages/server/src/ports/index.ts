// src/ports/index.ts

// Error types and utilities
export type { PortError, PortErrorCode } from './errors.js';
export { createPortError } from './errors.js';

// Error mapping
export { mapInfraError } from './error-mapping.js';

// Port registry keys
export { PORT_KEYS, type PortKey } from './keys.js';

// Shared types
export type { ReadContext, SubscribablePort, Unsubscribe } from './shared.js';
export { createReadContext } from './shared.js';

// Port interfaces
import type { CronPort } from './cron-port.js';
import type { GatewayPort } from './gateway-port.js';
import type { LifetimePort } from './lifetime-port.js';
import type { LogPort } from './log-port.js';
import type { MetricsPort } from './metrics-port.js';
import type { SessionPort } from './session-port.js';
import type { SystemPort } from './system-port.js';
import type { TranscriptPort } from './transcript-port.js';
import type { UsagePort } from './usage-port.js';

export type { CronEntry, CronPort } from './cron-port.js';
export type { ChannelInfo, GatewayPort, GatewayStatus } from './gateway-port.js';
export type { LifetimePort, LifetimeStats } from './lifetime-port.js';
export type { LogEntry, LogPort } from './log-port.js';
export type { MetricsPort, MetricsRangeKey, MetricsResult } from './metrics-port.js';
export type { SessionPort } from './session-port.js';
export type { SystemMetrics, SystemPort } from './system-port.js';
export type { TranscriptPort } from './transcript-port.js';
export type { UsageCost, UsagePort } from './usage-port.js';

// Platform types (re-export from existing types.ts)
export type { CliAdapter, Platform, ProcessAdapter } from './types.js';

/**
 * Typed port registry interface.
 *
 * All ports are required and must be present after context initialization.
 */
export interface TypedPorts {
  /** Session data access port */
  sessions: SessionPort;

  /** Metrics aggregation port */
  metrics: MetricsPort;

  /** Gateway CLI interaction port */
  gateway: GatewayPort;

  /** Cron job data access port */
  cron: CronPort;

  /** Log data access port */
  logs: LogPort;

  /** System information port */
  system: SystemPort;

  /** Lifetime statistics port */
  lifetime: LifetimePort;

  /** Transcript path resolution port */
  transcript: TranscriptPort;

  /** Usage cost data port */
  usage: UsagePort;
}
