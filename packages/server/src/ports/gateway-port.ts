// src/ports/gateway-port.ts
import type { ReadContext } from './shared.js';

/**
 * Gateway channel information.
 *
 * NOTE: This contract reflects gateway status `channelSummary` parsing output.
 */
export interface ChannelInfo {
  provider: string;
  name: string | null;
  connected: boolean;
  latencyMs: number | null;
}

/**
 * Gateway status information.
 */
export interface GatewayStatus {
  running: boolean;
  pid: number | null;
  version: string;
  updateAvailable: string | null;
  uptime: string;
  startedAt: string | null;
  channels: ChannelInfo[];
  connectLatencyMs: number | null;
  latestVersion: string | null;
  securitySummary: { critical: number; warn: number; info: number };
  sessionDefaults: { model: string; contextTokens: number } | null;
}

/**
 * Port contract for OpenClaw gateway CLI interactions.
 * Provides read access to gateway process status and version information.
 *
 * @consistency eventual (CLI command output, no persistence)
 * @mode async (remote process execution)
 */
export interface GatewayPort {
  /**
   * Get current gateway status.
   * Executes `openclaw status --json` and parses the output.
   *
   * @consistency eventual
   * @mode async
   * @timeoutMs 5000
   * @param context - Optional request-level context
   * @returns Gateway status information
   */
  getGatewayStatus(context?: ReadContext): Promise<GatewayStatus>;

  /**
   * Get OpenClaw gateway version.
   * Executes `openclaw --version` and extracts version string.
   *
   * @consistency eventual
   * @mode async
   * @timeoutMs 3000
   * @param context - Optional request-level context
   * @returns Version string
   */
  getVersion(context?: ReadContext): Promise<string>;

  /**
   * Warm up internal caches by pre-fetching status and version.
   * Useful for reducing latency on first request.
   *
   * @mode async
   * @timeoutMs 10000
   */
  warmCache(): Promise<void>;
}
