// src/context/ports.ts
import { createCronAdapter } from '../adapters/cron-adapter.js';
import { createGatewayAdapter } from '../adapters/gateway-adapter.js';
import { createLogAdapter } from '../adapters/log-adapter.js';
import { createMetricsAdapter } from '../adapters/metrics-adapter.js';
import { createSessionAdapter } from '../adapters/session-adapter.js';
import { createSystemAdapter } from '../adapters/system-adapter.js';
import type { Pipeline } from '../pipeline/index.js';
import { PORT_KEYS, type TypedPorts } from '../ports/index.js';
import type { Platform } from '../ports/types.js';
import type { Aggregator } from '../sources/aggregator.js';
import type { LogTailer } from '../sources/collectors/log/tailer.js';
import type { GatewayClient } from '../sources/gateway-cli.js';
import type { CronReader } from '../sources/readers/cron-reader.js';
import type { SessionReader } from '../sources/readers/session-reader.js';
import type { SystemInfoService } from '../sources/system-info.js';

/**
 * Build and register all ports (Phase 1 + Phase 2) in the pipeline.
 *
 * @param pipeline - Pipeline instance to register ports into
 * @param deps - Dependencies for port creation
 */
export function registerPorts(
  pipeline: Pipeline,
  deps: {
    sessionReader: SessionReader;
    aggregator: Aggregator;
    gatewayClient: GatewayClient;
    cronReader: CronReader;
    logTailer: LogTailer;
    systemInfoService: SystemInfoService;
    platform: Platform;
  },
): void {
  // Phase 1 ports
  const sessionAdapter = createSessionAdapter(deps.sessionReader);
  const metricsAdapter = createMetricsAdapter(deps.aggregator);
  const gatewayAdapter = createGatewayAdapter(deps.gatewayClient);

  // Phase 2 ports
  const cronAdapter = createCronAdapter(deps.cronReader);
  const logAdapter = createLogAdapter(deps.logTailer);
  const systemAdapter = createSystemAdapter(deps.systemInfoService, deps.platform);

  pipeline.addPort(PORT_KEYS.sessions, sessionAdapter);
  pipeline.addPort(PORT_KEYS.metrics, metricsAdapter);
  pipeline.addPort(PORT_KEYS.gateway, gatewayAdapter);
  pipeline.addPort(PORT_KEYS.cron, cronAdapter);
  pipeline.addPort(PORT_KEYS.logs, logAdapter);
  pipeline.addPort(PORT_KEYS.system, systemAdapter);
}

/**
 * Retrieve all registered ports from the pipeline and assemble into TypedPorts.
 *
 * @param pipeline - Pipeline instance with registered ports
 * @returns TypedPorts object with all ports
 */
export function getPorts(pipeline: Pipeline): TypedPorts {
  return {
    sessions: pipeline.getPort(PORT_KEYS.sessions),
    metrics: pipeline.getPort(PORT_KEYS.metrics),
    gateway: pipeline.getPort(PORT_KEYS.gateway),
    cron: pipeline.getPort(PORT_KEYS.cron),
    logs: pipeline.getPort(PORT_KEYS.logs),
    system: pipeline.getPort(PORT_KEYS.system),
  };
}
