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
export type { CronEntry, CronPort } from './cron-port.js';
export type { ChannelInfo, GatewayPort, GatewayStatus } from './gateway-port.js';
export type { LogEntry, LogPort } from './log-port.js';
export type { MetricsPort, MetricsRangeKey, MetricsResult } from './metrics-port.js';
export type { SessionPort } from './session-port.js';
export type { SystemMetrics, SystemPort } from './system-port.js';

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
}
