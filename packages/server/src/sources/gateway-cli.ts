import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { emitChange } from '../events.js';
import { config, CLI_ENV } from '../config.js';

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
    console.warn('[gateway-cli] CLI call failed:', args, (err as Error).message);
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

export function parseStatus(json: string, version: string): ParsedStatus {
  try {
    const d = JSON.parse(json);
    const gw = d?.gateway ?? {};
    const svc = d?.gatewayService ?? {};
    const channelSummary = d?.channelSummary ?? [];
    const update = d?.update ?? {};

    const pidMatch = svc?.runtimeShort?.match(/pid\s+(\d+)/);
    const pid = pidMatch ? Number(pidMatch[1]) : null;
    const running = Boolean(gw?.reachable) || svc?.runtimeShort?.includes('running');

    const latest = update?.latestVersion ?? null;
    const updateAvailable = latest && latest !== version ? latest : null;

    const connectLatencyMs = gw?.connectLatencyMs ?? null;
    const latestVersion = update?.latestVersion ?? null;
    const secAudit = d?.securityAudit?.summary ?? { critical: 0, warn: 0, info: 0 };
    const sessionDefaults = d?.sessions?.defaults ?? null;

    return {
      running: Boolean(running),
      pid,
      version: version ?? 'unknown',
      updateAvailable,
      uptime: 'unknown',
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

export async function getGatewayStatus(): Promise<ParsedStatus> {
  if (statusCache && Date.now() - statusCache.ts < CACHE_TTL) {
    return statusCache.data;
  }
  const [raw, version] = await Promise.all([execCli('status --json'), getVersion()]);
  const status = parseStatus(raw, version);
  const prevJson = statusCache ? JSON.stringify(statusCache.data) : '';
  statusCache = { data: status, ts: Date.now() };
  if (JSON.stringify(status) !== prevJson) {
    emitChange('gateway');
  }
  return status;
}
