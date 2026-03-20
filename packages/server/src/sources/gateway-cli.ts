import { open, stat } from 'node:fs/promises';

import { config } from '../config.js';
import { emitChange } from '../events.js';
import type { ChannelInfo } from '../platforms/shared/parsers.js';
import { parseChannels } from '../platforms/shared/parsers.js';
import type { Platform } from '../ports/types.js';

// Re-export shared parsers for test/consumer convenience
export type { ChannelInfo } from '../platforms/shared/parsers.js';
export { formatUptime, parseChannels } from '../platforms/shared/parsers.js';

interface CachedResult<T> {
  data: T;
  ts: number;
  ttl: number;
}

function isCacheValid<T>(cache: CachedResult<T> | null): cache is CachedResult<T> {
  return cache !== null && Date.now() - cache.ts < cache.ttl;
}

const CACHE_TTL = 10_000; // 10s
const FAIL_CACHE_TTL = 3_000; // 3s — short TTL for failed results to avoid request storms
const VERSION_CACHE_TTL = 60_000; // 1min
const VERSION_FAIL_CACHE_TTL = 5_000; // 5s
// 30s balances smoothing transient CLI status parse/timeouts vs delaying real-down detection too long.
const STATUS_STALE_FALLBACK_MS = 30_000;

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

type StatusParseResult = { ok: true; data: ParsedStatus } | { ok: false; reason: 'empty' | 'invalid-json' };

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
  // In 0.1.1, stale fallback is internal-only (no API field yet).
  let lastSuccessfulStatus: { data: ParsedStatus; ts: number } | null = null;

  async function getVersion(): Promise<string> {
    if (isCacheValid(versionCache)) {
      return versionCache.data;
    }
    const raw = (await platform.cli.exec(['--version'])).trim();
    const version = raw || 'unknown';
    versionCache = { data: version, ts: Date.now(), ttl: raw ? VERSION_CACHE_TTL : VERSION_FAIL_CACHE_TTL };
    return version;
  }

  async function parseStatusJson(json: string, version: string): Promise<StatusParseResult> {
    if (json.trim() === '') {
      return { ok: false, reason: 'empty' };
    }

    let d: Record<string, unknown>;
    try {
      d = JSON.parse(json) as Record<string, unknown>;
    } catch {
      return { ok: false, reason: 'invalid-json' };
    }

    try {
      const gw = (d.gateway ?? {}) as Record<string, unknown>;
      const svc = (d.gatewayService ?? {}) as Record<string, unknown>;
      const channelSummary = (d.channelSummary ?? []) as string[];
      const update = (d.update ?? {}) as Record<string, unknown>;
      const updateRegistry = (update.registry ?? {}) as Record<string, unknown>;
      const securityAudit = (d.securityAudit ?? {}) as Record<string, unknown>;
      const secAudit = (securityAudit.summary ?? { critical: 0, warn: 0, info: 0 }) as Record<string, unknown>;
      const sessions = (d.sessions ?? {}) as Record<string, unknown>;

      const runtimeShort = typeof svc.runtimeShort === 'string' ? svc.runtimeShort : '';
      const pidMatch = runtimeShort.match(/pid\s+(\d+)/);
      let pid = pidMatch ? Number(pidMatch[1]) : null;
      const running = gw.reachable === true || runtimeShort.includes('running');

      // Fallback: find gateway PID via platform adapter
      if (!pid && running) {
        const port = typeof gw.port === 'number' ? gw.port : 18789;
        pid = await platform.process.findPidByPort(port);
      }

      const latestFromRegistry = typeof updateRegistry.latestVersion === 'string' ? updateRegistry.latestVersion : null;
      const latestFromUpdate = typeof update.latestVersion === 'string' ? update.latestVersion : null;
      const latest = latestFromRegistry ?? latestFromUpdate;
      const updateAvailable = latest && latest !== version ? latest : null;

      const connectLatencyMs = typeof gw.connectLatencyMs === 'number' ? gw.connectLatencyMs : null;
      const latestVersion = latestFromRegistry ?? latestFromUpdate;

      const rawSessionDefaults = sessions.defaults as Record<string, unknown> | null | undefined;
      const sessionDefaults =
        rawSessionDefaults &&
        typeof rawSessionDefaults.model === 'string' &&
        typeof rawSessionDefaults.contextTokens === 'number'
          ? { model: rawSessionDefaults.model, contextTokens: rawSessionDefaults.contextTokens }
          : null;

      const critical = typeof secAudit.critical === 'number' ? secAudit.critical : 0;
      const warn = typeof secAudit.warn === 'number' ? secAudit.warn : 0;
      const info = typeof secAudit.info === 'number' ? secAudit.info : 0;

      const startedAt = pid ? await getStartedAtFromLog(pid) : null;

      return {
        ok: true,
        data: {
          running,
          pid,
          version: version ?? 'unknown',
          updateAvailable,
          uptime: pid ? await platform.process.getUptime(pid) : 'unknown',
          startedAt,
          channels: parseChannels(channelSummary),
          connectLatencyMs,
          latestVersion,
          securitySummary: {
            critical,
            warn,
            info,
          },
          sessionDefaults,
        },
      };
    } catch {
      // Treat structurally-invalid JSON payloads the same as parse failures.
      return { ok: false, reason: 'invalid-json' };
    }
  }

  function unavailableStatus(): ParsedStatus {
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

  async function getGatewayStatus(): Promise<ParsedStatus> {
    if (isCacheValid(statusCache)) {
      return statusCache.data;
    }
    if (statusInFlight) {
      return statusInFlight;
    }

    statusInFlight = (async () => {
      try {
        const [raw, version] = await Promise.all([platform.cli.exec(['gateway', 'status', '--json']), getVersion()]);
        const parsed = await parseStatusJson(raw, version);
        let status: ParsedStatus;
        let ttl: number;

        if (parsed.ok) {
          status = parsed.data;
          lastSuccessfulStatus = { data: status, ts: Date.now() };
          ttl = status.running ? CACHE_TTL : FAIL_CACHE_TTL;
        } else {
          const staleAge = lastSuccessfulStatus ? Date.now() - lastSuccessfulStatus.ts : Number.POSITIVE_INFINITY;
          if (lastSuccessfulStatus && staleAge <= STATUS_STALE_FALLBACK_MS) {
            // Intentionally do NOT refresh lastSuccessfulStatus.ts here:
            // stale window is anchored to the last real successful parse.
            status = lastSuccessfulStatus.data;
            ttl = FAIL_CACHE_TTL;
          } else {
            status = unavailableStatus();
            ttl = FAIL_CACHE_TTL;
          }
        }

        const curJson = JSON.stringify(status);
        statusCache = { data: status, ts: Date.now(), ttl };
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
