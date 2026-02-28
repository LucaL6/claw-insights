import { open, stat } from 'node:fs/promises';

import { config } from '../config.js';
import { emitChange } from '../events.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('gateway-cli');
import type { ChannelInfo } from '../platforms/shared/parsers.js';
import { parseChannels } from '../platforms/shared/parsers.js';
import type { Platform } from '../ports/types.js';

// Re-export shared parsers for test/consumer convenience
export type { ChannelInfo } from '../platforms/shared/parsers.js';
export { formatUptime, parseChannels } from '../platforms/shared/parsers.js';

interface CachedResult<T> {
  data: T;
  ts: number;
}

const CACHE_TTL = 10_000; // 10s
const FAIL_CACHE_TTL = 3_000; // 3s — short TTL for failed results to avoid request storms
const VERSION_CACHE_TTL = 60_000; // 1min
const VERSION_FAIL_CACHE_TTL = 5_000; // 5s

export interface ParsedStatus {
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

export interface GatewayClient {
  getGatewayStatus(): Promise<ParsedStatus>;
  getVersion(): Promise<string>;
  warmCache(): Promise<void>;
}

// ── Factory function ──────────────────────────────────────────────

export function createGatewayClient(platform: Platform, options?: { gatewayLogPath?: string }): GatewayClient {
  const logPath = options?.gatewayLogPath ?? config.openclawDir + '/logs/gateway.log';

  async function getStartedAtFromLog(pid: number): Promise<string | null> {
    try {
      const info = await stat(logPath);
      const TAIL_SIZE = 64 * 1024;
      const readSize = Math.min(TAIL_SIZE, info.size);
      const offset = info.size - readSize;

      const fh = await open(logPath, 'r');
      try {
        const buf = Buffer.alloc(readSize);
        const { bytesRead } = await fh.read(buf, 0, readSize, offset);
        const text = buf.subarray(0, bytesRead).toString('utf-8');
        const pattern = new RegExp(`^(\\S+)\\s+\\[gateway\\]\\s+listening\\s+on\\s+\\S+\\s+\\(PID\\s+${pid}\\)`, 'gm');
        let lastMatch: string | null = null;
        let m: RegExpExecArray | null;
        while ((m = pattern.exec(text)) !== null) {
          lastMatch = m[1];
        }
        if (!lastMatch) {
          return null;
        }
        const d = new Date(lastMatch);
        if (isNaN(d.getTime())) {
          return null;
        }
        return d.toISOString();
      } finally {
        await fh.close();
      }
    } catch {
      // Log missing, unreadable, or no match — graceful degradation
      return null;
    }
  }
  let statusCache: CachedResult<ParsedStatus> | null = null;
  let versionCache: CachedResult<string> | null = null;
  let statusInFlight: Promise<ParsedStatus> | null = null;
  let lastStatusJson = ''; // Track last status independently of cache for change detection

  async function getVersion(): Promise<string> {
    if (versionCache && Date.now() - versionCache.ts < VERSION_CACHE_TTL) {
      return versionCache.data;
    }
    const raw = (await platform.cli.exec(['--version'])).trim();
    const version = raw || 'unknown';
    // Short TTL for failed results to allow faster recovery without request storms
    versionCache = { data: version, ts: Date.now() - (raw ? 0 : VERSION_CACHE_TTL - VERSION_FAIL_CACHE_TTL) };
    return version;
  }

  async function parseStatusJson(json: string, version: string): Promise<ParsedStatus> {
    try {
      const d = JSON.parse(json);
      const gw = d?.gateway ?? {};
      const svc = d?.gatewayService ?? {};
      const channelSummary = d?.channelSummary ?? [];
      const update = d?.update ?? {};

      const pidMatch = svc?.runtimeShort?.match(/pid\s+(\d+)/);
      let pid = pidMatch ? Number(pidMatch[1]) : null;
      const running = Boolean(gw?.reachable) || svc?.runtimeShort?.includes('running');

      // Fallback: find gateway PID via platform adapter
      if (!pid && running) {
        pid = await platform.process.findPidByPort(gw?.port ?? 18789);
      }

      const latest = update?.registry?.latestVersion ?? update?.latestVersion ?? null;
      const updateAvailable = latest && latest !== version ? latest : null;

      const connectLatencyMs = gw?.connectLatencyMs ?? null;
      const latestVersion = update?.registry?.latestVersion ?? update?.latestVersion ?? null;
      const secAudit = d?.securityAudit?.summary ?? { critical: 0, warn: 0, info: 0 };
      const sessionDefaults = d?.sessions?.defaults ?? null;

      const startedAt = pid ? await getStartedAtFromLog(pid) : null;

      return {
        running: Boolean(running),
        pid,
        version: version ?? 'unknown',
        updateAvailable,
        uptime: pid ? await platform.process.getUptime(pid) : 'unknown',
        startedAt,
        channels: parseChannels(channelSummary),
        connectLatencyMs,
        latestVersion,
        securitySummary: {
          critical: secAudit.critical ?? 0,
          warn: secAudit.warn ?? 0,
          info: secAudit.info ?? 0,
        },
        sessionDefaults,
      };
    } catch {
      return {
        running: false,
        pid: null,
        version: 'unknown',
        updateAvailable: null,
        uptime: 'unknown',
        startedAt: null,
        channels: [],
        connectLatencyMs: null,
        latestVersion: null,
        securitySummary: { critical: 0, warn: 0, info: 0 },
        sessionDefaults: null,
      };
    }
  }

  async function getGatewayStatus(): Promise<ParsedStatus> {
    if (statusCache && Date.now() - statusCache.ts < CACHE_TTL) {
      return statusCache.data;
    }
    if (statusInFlight) {
      return statusInFlight;
    }

    statusInFlight = (async () => {
      try {
        const [raw, version] = await Promise.all([platform.cli.exec(['status', '--json']), getVersion()]);
        log.info({ rawLen: raw.length, version, rawStart: raw.slice(0, 80) }, 'CLI status result');
        const status = await parseStatusJson(raw, version);
        const curJson = JSON.stringify(status);
        // Short TTL for failed results — fast recovery without request storms
        const ttl = status.running ? CACHE_TTL : FAIL_CACHE_TTL;
        statusCache = { data: status, ts: Date.now() - (CACHE_TTL - ttl) };
        if (curJson !== lastStatusJson) {
          lastStatusJson = curJson;
          emitChange('gateway');
        }
        return status;
      } finally {
        statusInFlight = null;
      }
    })();

    return statusInFlight;
  }

  async function warmCache(): Promise<void> {
    try {
      await getGatewayStatus();
    } catch {
      /* ignore startup failure */
    }
  }

  return { getGatewayStatus, getVersion, warmCache };
}
