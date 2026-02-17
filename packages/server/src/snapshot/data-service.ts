import type { Detail, Range } from './types';

// ─── Data Sources ────────────────────────────────────────────────

export interface DataSources {
  getGateway: () => Promise<{ running: boolean; version: string; uptime: string; [k: string]: unknown }>;
  getChannels: () => Promise<{ provider: string; name: string; connected: boolean; latencyMs: number | null }[]>;
  getSessions: () => unknown[];
  getMetrics: (range: string) => {
    totalTokensK: number;
    totalErrors: number;
    totalWarnings: number;
    uptimePercent: number;
    buckets: Record<string, unknown>[];
  };
  getRecentErrors: (limit: number) => { timestamp: string; type: string; module: string; message: string }[];
}

// ─── Output Types ────────────────────────────────────────────────

export interface SnapshotSession {
  name: string;
  status: string;
  model: string;
  modelDisplay: string;
  channel: string;
  totalTokens: number;
  totalTokensDisplay: string;
  usagePercent: number;
  updatedAt: string;
  subAgentCount: number;
  subAgents?: { name: string; status: string; completed: boolean; updatedAt: string }[];
}

export interface SnapshotData {
  gateway: { status: 'up' | 'down' | 'connecting'; version: string; uptime: string; cpu: number; memoryMB: number };
  channels: { name: string; provider: string; connected: boolean; latencyMs: number | null }[];
  timestamp: string;
  range: string;
  time: string;
  summary: {
    activeSessions: number;
    totalSessions: number;
    tokens: number;
    tokensDisplay: string;
    errors: number;
    warnings: number;
    uptimePercent: number;
  };
  sparklines: {
    sessions: number[];
    tokens: number[];
    errors: number[];
    uptime: ('up' | 'degraded' | 'down')[];
  };
  buckets?: Record<string, unknown>[];
  sessions?: SnapshotSession[];
  recentErrors?: { timestamp: string; type: string; module: string; message: string }[];
}

// ─── Helpers ─────────────────────────────────────────────────────

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function friendlyModel(model: string): string {
  // "anthropic/claude-opus-4-6" → "Opus 4.6"
  const last = model.includes('/') ? model.split('/').pop()! : model;
  // strip provider prefix like "claude-"
  const stripped = last.replace(/^claude-/, '');
  // split by "-", capitalize first segment, join rest with "."
  const parts = stripped.split('-');
  if (parts.length === 0) return model;
  const name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const version = parts.slice(1).join('.');
  return version ? `${name} ${version}` : name;
}

export function normalize(values: number[]): number[] {
  if (values.length === 0) return [];
  const max = Math.max(...values);
  if (max === 0) return values.map(() => 0);
  return values.map((v) => Math.round((v / max) * 100));
}

export function relativeTime(input: number | string): string {
  const ts = typeof input === 'number' ? input : new Date(input).getTime();
  if (!ts || isNaN(ts)) return '—';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Sampling ────────────────────────────────────────────────────

function sample<T>(arr: T[], count: number): T[] {
  if (arr.length <= count) return arr;
  const step = (arr.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => arr[Math.round(i * step)]);
}

function uptimeStatus(percent: number): 'up' | 'degraded' | 'down' {
  if (percent >= 99) return 'up';
  if (percent >= 90) return 'degraded';
  return 'down';
}

// ─── Core ────────────────────────────────────────────────────────

const RANGE_DISPLAY: Record<string, string> = {
  ONE_HOUR: '1h', SIX_HOUR: '6h', TWELVE_HOUR: '12h', TWENTY_FOUR_HOUR: '24h',
};

const CHANNEL_SHORT: Record<string, string> = {
  telegram: 'TG', slack: 'Slack', discord: 'Discord',
  whatsapp: 'WA', signal: 'Signal', webchat: 'Web',
  irc: 'IRC', googlechat: 'GChat', imessage: 'iMsg',
};

export async function buildSnapshotData(
  sources: DataSources,
  opts: { detail: Detail; range: Range },
): Promise<SnapshotData> {
  const { detail, range } = opts;

  // 1. Fetch raw data
  const gw = await sources.getGateway();
  const channels = await sources.getChannels();
  const rawSessions = sources.getSessions() as Record<string, unknown>[];
  const metrics = sources.getMetrics(range);

  // Gateway
  const gateway: SnapshotData['gateway'] = {
    status: gw.running ? 'up' : 'down',
    version: gw.version,
    uptime: gw.uptime,
    cpu: (gw.cpu as number) ?? 0,
    memoryMB: (gw.memoryMB as number) ?? 0,
  };

  // 2. Summary
  const tokensRaw = metrics.totalTokensK * 1000;
  const activeSessions = rawSessions.filter((s) => (s.status as string)?.toLowerCase() === 'active').length;
  const summary: SnapshotData['summary'] = {
    activeSessions,
    totalSessions: rawSessions.length,
    tokens: Math.round(tokensRaw),
    tokensDisplay: formatTokens(tokensRaw),
    errors: metrics.totalErrors,
    warnings: metrics.totalWarnings,
    uptimePercent: metrics.uptimePercent,
  };

  // 3. Sparklines from buckets (sample 12 points)
  const buckets = metrics.buckets;
  const sampled = sample(buckets, 12);
  const sparklines: SnapshotData['sparklines'] = {
    sessions: normalize(sampled.map((b) => (b.sessions as number) ?? 0)),
    tokens: normalize(sampled.map((b) => (b.tokensK as number) ?? (b.tokens as number) ?? 0)),
    errors: normalize(sampled.map((b) => (b.errors as number) ?? 0)),
    uptime: sampled.map((b) => uptimeStatus((b.uptimePercent as number) ?? 100)),
  };

  // 4. Build sessions list
  const buildSession = (s: Record<string, unknown>, includeSubs: boolean): SnapshotSession => {
    const model = (s.model as string) ?? '';
    const totalTokens = (s.totalTokens as number) ?? 0;
    const subs = (s.subAgents as Record<string, unknown>[]) ?? [];
    const session: SnapshotSession = {
      name: (s.displayName as string) ?? (s.name as string) ?? '',
      status: typeof s.status === 'string' ? s.status.toLowerCase() : 'unknown',
      model,
      modelDisplay: friendlyModel(model),
      channel: (s.channel as string) ?? '',
      totalTokens,
      totalTokensDisplay: formatTokens(totalTokens),
      usagePercent: (s.usagePercent as number) ?? 0,
      updatedAt: relativeTime(s.updatedAt ?? new Date().toISOString()),
      subAgentCount: subs.length,
    };
    if (includeSubs && subs.length > 0) {
      session.subAgents = subs.map((a) => ({
        name: (a.displayName as string) ?? (a.name as string) ?? '',
        status: (a.status as string) ?? '',
        completed: (a.completed as boolean) ?? false,
        updatedAt: relativeTime(a.updatedAt ?? new Date().toISOString()),
      }));
    }
    return session;
  };

  // Base result (compact)
  const result: SnapshotData = {
    gateway,
    channels: channels.map((c) => ({
      name: CHANNEL_SHORT[c.provider?.toLowerCase()] ?? c.name,
      provider: c.provider,
      connected: c.connected,
      latencyMs: c.latencyMs,
    })),
    timestamp: new Date().toISOString(),
    range: RANGE_DISPLAY[range] ?? range,
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    summary,
    sparklines,
  };

  // Detail augmentation
  if (detail === 'standard' || detail === 'full') {
    result.buckets = buckets;
  }

  // Only include active sessions, sorted by token usage
  const activeSorted = [...rawSessions]
    .filter((s) => (s.status as string)?.toLowerCase() === 'active')
    .sort((a, b) => ((b.totalTokens as number) ?? 0) - ((a.totalTokens as number) ?? 0));

  if (detail === 'standard') {
    result.sessions = activeSorted.slice(0, 8).map((s) => buildSession(s, false));
  }

  if (detail === 'full') {
    result.sessions = activeSorted.slice(0, 20).map((s) => buildSession(s, true));
    const errResult = sources.getRecentErrors(5);
    result.recentErrors = Array.isArray(errResult) ? errResult : (errResult as unknown as { events: typeof result.recentErrors }).events ?? [];
  }

  return result;
}
