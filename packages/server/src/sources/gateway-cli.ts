import { execFile, execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { promisify } from 'node:util';

import { CLI_ENV,config } from '../config.js';
import { emitChange } from '../events.js';
import { createChildLogger } from '../logger.js';

const log = createChildLogger('gateway-cli');

const execFileAsync = promisify(execFile);

interface CachedResult<T> {
  data: T;
  ts: number;
}

const CACHE_TTL = 10_000; // 10s

let statusCache: CachedResult<ParsedStatus> | null = null;
let versionCache: CachedResult<string> | null = null;
const VERSION_CACHE_TTL = 60_000; // 1min

export interface ChannelInfo {
  provider: string;
  name: string;
  connected: boolean;
  latencyMs: number | null;
}

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

async function execCli(args: string): Promise<string> {
  try {
    const { stdout } = await execFileAsync(config.cliPath, args.split(/\s+/), {
      timeout: 8000,
      encoding: 'utf-8',
      env: CLI_ENV,
    });
    return stdout;
  } catch (err) {
    log.warn({ err: err as Error, args }, 'CLI call failed');
    return '';
  }
}

export async function getVersion(): Promise<string> {
  if (versionCache && Date.now() - versionCache.ts < VERSION_CACHE_TTL) {
    return versionCache.data;
  }
  const raw = (await execCli('--version')).trim();
  const version = raw || 'unknown';
  versionCache = { data: version, ts: Date.now() };
  return version;
}

export function parseChannels(summary: string[]): ChannelInfo[] {
  const channels: ChannelInfo[] = [];
  for (const line of summary) {
    const match = line.match(/^(\w+):\s*(\w+)/);
    if (match) {
      channels.push({
        provider: match[1].toLowerCase(),
        name: match[1],
        connected: match[2] === 'configured' || match[2] === 'connected',
        latencyMs: null,
      });
    }
  }
  return channels;
}

export function formatUptime(etimeStr: string): string {
  // Parse `ps -o etime=` output: [[DD-]HH:]MM:SS
  const parts = etimeStr.trim().replace(/-/g, ':').split(':').map(Number);
  let secs = 0;
  if (parts.length === 4) {secs = parts[0] * 86400 + parts[1] * 3600 + parts[2] * 60 + parts[3];}
  else if (parts.length === 3) {secs = parts[0] * 3600 + parts[1] * 60 + parts[2];}
  else if (parts.length === 2) {secs = parts[0] * 60 + parts[1];}

  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) {return `${d}d ${h}h`;}
  if (h > 0) {return `${h}h ${m}m`;}
  return `${m}m`;
}

/**
 * Find PID listening on a given TCP port via /proc/net/tcp + /proc/PID/fd.
 * Works on Linux without lsof/fuser/ss. Returns null on non-Linux or failure.
 */
function findPidByPort(port: number): number | null {
  try {
    const hexPort = port.toString(16).toUpperCase().padStart(4, '0');
    const inodes = new Set<string>();
    // Scan both IPv4 and IPv6 TCP sockets
    for (const tcpFile of ['/proc/net/tcp', '/proc/net/tcp6']) {
      try {
        const tcp = readFileSync(tcpFile, 'utf-8');
        for (const line of tcp.split('\n').slice(1)) {
          const cols = line.trim().split(/\s+/);
          if (!cols[1]) {continue;}
          const localPort = cols[1].split(':').pop();
          if (localPort === hexPort && cols[3] === '0A') {
            // 0A = LISTEN
            inodes.add(cols[9]); // inode
          }
        }
      } catch {
        /* file not present */
      }
    }
    if (inodes.size === 0) {return null;}

    // Scan /proc/*/fd to find which PID owns the socket inode
    const procs = readdirSync('/proc').filter((d) => /^\d+$/.test(d));
    for (const p of procs) {
      try {
        const fds = readdirSync(`/proc/${p}/fd`);
        for (const fd of fds) {
          try {
            const link = readlinkSync(`/proc/${p}/fd/${fd}`);
            const m = link.match(/socket:\[(\d+)\]/);
            if (m && inodes.has(m[1])) {return parseInt(p, 10);}
          } catch {
            /* permission denied */
          }
        }
      } catch {
        /* process gone or no access */
      }
    }
  } catch {
    /* /proc not available */
  }
  return null;
}

function getUptimeFromPid(pid: number | null): string {
  if (!pid) {return 'unknown';}

  // Method 1: ps command (macOS + Linux with procps)
  try {
    const raw = execFileSync('ps', ['-o', 'etime=', '-p', String(pid)], {
      timeout: 2000,
      encoding: 'utf-8',
    });
    return formatUptime(raw);
  } catch {
    /* ps not available or failed */
  }

  // Method 2: /proc fallback (Linux without procps)
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf-8');
    // Skip comm field (may contain spaces) by finding closing paren
    const afterComm = stat.slice(stat.lastIndexOf(') ') + 2);
    const fields = afterComm.split(' ');
    const startTicks = Number(fields[19]); // field 22 minus 2 (pid + comm skipped), 0-indexed = 19
    const uptimeRaw = readFileSync('/proc/uptime', 'utf-8');
    const bootSeconds = parseFloat(uptimeRaw.split(' ')[0]);
    const clkTck = 100;
    const processStartSec = startTicks / clkTck;
    const elapsedSec = Math.floor(bootSeconds - processStartSec);
    if (elapsedSec < 0) {return 'unknown';}
    const h = Math.floor(elapsedSec / 3600);
    const m = Math.floor((elapsedSec % 3600) / 60);
    const s = elapsedSec % 60;
    if (h > 0) {return `${h}h ${m}m`;}
    if (m > 0) {return `${m}m ${s}s`;}
    return `${s}s`;
  } catch {
    /* /proc not available (macOS) */
  }

  return 'unknown';
}

export function parseStatus(json: string, version: string): ParsedStatus {
  try {
    const d = JSON.parse(json);
    const gw = d?.gateway ?? {};
    const svc = d?.gatewayService ?? {};
    const channelSummary = d?.channelSummary ?? [];
    const update = d?.update ?? {};

    const pidMatch = svc?.runtimeShort?.match(/pid\s+(\d+)/);
    let pid = pidMatch ? Number(pidMatch[1]) : null;
    const running = Boolean(gw?.reachable) || svc?.runtimeShort?.includes('running');

    // Fallback: find gateway PID via /proc/net/tcp when systemctl unavailable
    if (!pid && running) {
      pid = findPidByPort(gw?.port ?? 18789);
    }

    const latest = update?.registry?.latestVersion ?? update?.latestVersion ?? null;
    const updateAvailable = latest && latest !== version ? latest : null;

    const connectLatencyMs = gw?.connectLatencyMs ?? null;
    const latestVersion = update?.registry?.latestVersion ?? update?.latestVersion ?? null;
    const secAudit = d?.securityAudit?.summary ?? { critical: 0, warn: 0, info: 0 };
    const sessionDefaults = d?.sessions?.defaults ?? null;

    return {
      running: Boolean(running),
      pid,
      version: version ?? 'unknown',
      updateAvailable,
      uptime: getUptimeFromPid(pid),
      startedAt: null,
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

export async function warmCache(): Promise<void> {
  try {
    await getGatewayStatus();
  } catch {
    /* ignore startup failure */
  }
}

let statusInFlight: Promise<ParsedStatus> | null = null;

export async function getGatewayStatus(): Promise<ParsedStatus> {
  if (statusCache && Date.now() - statusCache.ts < CACHE_TTL) {
    return statusCache.data;
  }
  if (statusInFlight) {return statusInFlight;}

  statusInFlight = (async () => {
    try {
      const [raw, version] = await Promise.all([execCli('status --json'), getVersion()]);
      const status = parseStatus(raw, version);
      const prevJson = statusCache ? JSON.stringify(statusCache.data) : '';
      statusCache = { data: status, ts: Date.now() };
      if (JSON.stringify(status) !== prevJson) {
        emitChange('gateway');
      }
      return status;
    } finally {
      statusInFlight = null;
    }
  })();

  return statusInFlight;
}
