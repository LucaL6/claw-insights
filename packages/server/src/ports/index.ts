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
 * Phase 1 ports (sessions, metrics, gateway) are required and must be present.
 * Phase 2 ports (cron, logs, system) are marked as optional (| undefined) and will be implemented later.
 */
export interface TypedPorts {
  /** Session data access port (Phase 1) */
  sessions: SessionPort;

  /** Metrics aggregation port (Phase 1) */
  metrics: MetricsPort;

  /** Gateway CLI interaction port (Phase 1) */
  gateway: GatewayPort;

  /** Cron job data access port (Phase 2 - not yet implemented) */
  cron: CronPort | undefined;

  /** Log data access port (Phase 2 - not yet implemented) */
  logs: LogPort | undefined;

  /** System information port (Phase 2 - not yet implemented) */
  system: SystemPort | undefined;
}
