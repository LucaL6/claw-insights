// src/adapters/gateway-adapter.ts
import { mapInfraError } from '../ports/error-mapping.js';
import type { GatewayPort, GatewayStatus } from '../ports/gateway-port.js';
import type { ReadContext } from '../ports/shared.js';
import type { GatewayClient } from '../sources/gateway-cli.js';

const SOURCE = 'gateway-adapter';

/**
 * Create a GatewayPort adapter that wraps GatewayClient.
 *
 * Gateway client is async and stateless (no subscriptions).
 * We normalize errors to PortError format.
 *
 * @param client - GatewayClient instance
 * @returns GatewayPort implementation
 */
export function createGatewayAdapter(client: GatewayClient): GatewayPort & { destroy: () => void } {
  async function getGatewayStatus(_context?: ReadContext): Promise<GatewayStatus> {
    try {
      return await client.getGatewayStatus();
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  async function getVersion(_context?: ReadContext): Promise<string> {
    try {
      return await client.getVersion();
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  async function warmCache(): Promise<void> {
    try {
      await client.warmCache();
    } catch (err) {
      throw mapInfraError(err, SOURCE);
    }
  }

  function destroy(): void {
    // Gateway client is stateless, nothing to clean up
  }

  return {
    getGatewayStatus,
    getVersion,
    warmCache,
    destroy,
  };
}
