import type { Detail, Range, DataSources, SnapshotData, SnapshotSession } from './snapshot-types.js';
import { formatTokens, friendlyModel, relativeTime, normalize, sample, uptimeStatus } from './snapshot-formatters.js';

// ─── Constants ───────────────────────────────────────────────────

const RANGE_DISPLAY: Record<string, string> = {
  ONE_HOUR: '1h',
  SIX_HOUR: '6h',
  TWELVE_HOUR: '12h',
  TWENTY_FOUR_HOUR: '24h',
};

const CHANNEL_SHORT: Record<string, string> = {
  telegram: 'TG',
  slack: 'Slack',
  discord: 'Discord',
  whatsapp: 'WA',
  signal: 'Signal',
  webchat: 'Web',
  irc: 'IRC',
  googlechat: 'GChat',
  imessage: 'iMsg',
};

// ─── Session Builder ─────────────────────────────────────────────

function buildSession(s: Record<string, unknown>, includeSubs: boolean): SnapshotSession {
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
}

// ─── Core Assembler ──────────────────────────────────────────────

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

  // 2. Gateway
  const gateway: SnapshotData['gateway'] = {
    status: gw.running ? 'up' : 'down',
    version: gw.version,
    uptime: gw.uptime,
    cpu: (gw.cpu as number) ?? 0,
    memoryMB: (gw.memoryMB as number) ?? 0,
  };

  // 3. Summary
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

  // 4. Sparklines (sample 12 points)
  const buckets = metrics.buckets;
  const sampled = sample(buckets, 12);
  const sparklines: SnapshotData['sparklines'] = {
    sessions: normalize(sampled.map((b) => (b.sessions as number) ?? 0)),
    tokens: normalize(sampled.map((b) => (b.tokensK as number) ?? (b.tokens as number) ?? 0)),
    errors: normalize(sampled.map((b) => (b.errors as number) ?? 0)),
    uptime: sampled.map((b) => uptimeStatus((b.uptimePercent as number) ?? 100)),
  };

  // 5. Base result (compact)
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

  // 6. Detail augmentation
  if (detail === 'standard' || detail === 'full') {
    result.buckets = buckets;
  }

  const activeSorted = [...rawSessions]
    .filter((s) => (s.status as string)?.toLowerCase() === 'active')
    .sort((a, b) => ((b.totalTokens as number) ?? 0) - ((a.totalTokens as number) ?? 0));

  if (detail === 'standard') {
    result.sessions = activeSorted.slice(0, 8).map((s) => buildSession(s, false));
  }

  if (detail === 'full') {
    result.sessions = activeSorted.slice(0, 20).map((s) => buildSession(s, true));
    const errResult = sources.getRecentErrors(5);
    result.recentErrors = Array.isArray(errResult)
      ? errResult
      : ((errResult as unknown as { events: typeof result.recentErrors }).events ?? []);
  }

  return result;
}
