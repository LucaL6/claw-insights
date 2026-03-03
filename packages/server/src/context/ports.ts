// src/context/ports.ts
import { createGatewayAdapter } from '../adapters/gateway-adapter.js';
import { createMetricsAdapter } from '../adapters/metrics-adapter.js';
import { createSessionAdapter } from '../adapters/session-adapter.js';
import type { Pipeline } from '../pipeline/index.js';
import { PORT_KEYS, type TypedPorts } from '../ports/index.js';
import type { Aggregator } from '../sources/aggregator.js';
import type { GatewayClient } from '../sources/gateway-cli.js';
import type { SessionReader } from '../sources/readers/session-reader.js';

/**
 * Build and register all Phase 1 ports in the pipeline.
 * Phase 2 ports (cron, logs, system) are not yet implemented.
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
  },
): void {
  // Phase 1 ports
  const sessionAdapter = createSessionAdapter(deps.sessionReader);
  const metricsAdapter = createMetricsAdapter(deps.aggregator);
  const gatewayAdapter = createGatewayAdapter(deps.gatewayClient);

  pipeline.addPort(PORT_KEYS.sessions, sessionAdapter);
  pipeline.addPort(PORT_KEYS.metrics, metricsAdapter);
  pipeline.addPort(PORT_KEYS.gateway, gatewayAdapter);
}

/**
 * Retrieve all registered ports from the pipeline and assemble into TypedPorts.
 *
 * Phase 1 ports (sessions, metrics, gateway) are required.
 * Phase 2 ports (cron, logs, system) return undefined.
 *
 * @param pipeline - Pipeline instance with registered ports
 * @returns TypedPorts object with Phase 1 ports and Phase 2 as undefined
 */
export function getPorts(pipeline: Pipeline): TypedPorts {
  return {
    sessions: pipeline.getPort(PORT_KEYS.sessions),
    metrics: pipeline.getPort(PORT_KEYS.metrics),
    gateway: pipeline.getPort(PORT_KEYS.gateway),
    // Phase 2 ports - not yet implemented
    cron: undefined,
    logs: undefined,
    system: undefined,
  };
}
