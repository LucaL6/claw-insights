import { execSync } from 'node:child_process';

interface CachedResult<T> {
  data: T;
  ts: number;
}

const CACHE_TTL = 10_000; // 10s
const CLI_PATH = process.env.OPENCLAW_CLI ?? './.npm-global/bin/openclaw';

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
}

function execCli(args: string): string {
  try {
    return execSync(`${CLI_PATH} ${args}`, {
      timeout: 8000,
      encoding: 'utf-8',
      env: { ...process.env, PATH: `${process.env.HOME}/.npm-global/bin:${process.env.HOME}/.bun/bin:${process.env.PATH}` },
    });
  } catch {
    return '';
  }
}

function getVersion(): string {
  if (versionCache && Date.now() - versionCache.ts < VERSION_CACHE_TTL) {
    return versionCache.data;
  }
  const raw = execCli('--version').trim();
  const version = raw || 'unknown';
  versionCache = { data: version, ts: Date.now() };
  return version;
}

function parseChannels(summary: string[]): ChannelInfo[] {
  // Parse lines like "Telegram: configured", "Slack: configured"
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

function parseStatus(json: string): ParsedStatus {
  try {
    const d = JSON.parse(json);
    const gw = d?.gateway ?? {};
    const svc = d?.gatewayService ?? {};
    const channelSummary = d?.channelSummary ?? [];
    const update = d?.update ?? {};

    // Extract PID from runtimeShort: "running (pid 97242, state active)"
    const pidMatch = svc?.runtimeShort?.match(/pid\s+(\d+)/);
    const pid = pidMatch ? Number(pidMatch[1]) : null;
    const running = Boolean(gw?.reachable) || svc?.runtimeShort?.includes('running');

    // Version from CLI --version (cached separately)
    const version = getVersion();
    const latest = update?.latestVersion ?? null;
    const updateAvailable = latest && latest !== version ? latest : null;

    return {
      running: Boolean(running),
      pid,
      version: version ?? 'unknown',
      updateAvailable,
      uptime: 'unknown',
      startedAt: null,
      channels: parseChannels(channelSummary),
    };
  } catch {
    return { running: false, pid: null, version: 'unknown', updateAvailable: null, uptime: 'unknown', startedAt: null, channels: [] };
  }
}

export function getGatewayStatus(): ParsedStatus {
  if (statusCache && Date.now() - statusCache.ts < CACHE_TTL) {
    return statusCache.data;
  }
  const raw = execCli('status --json');
  const status = parseStatus(raw);
  statusCache = { data: status, ts: Date.now() };
  return status;
}
