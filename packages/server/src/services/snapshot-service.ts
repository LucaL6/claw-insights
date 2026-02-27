import { RANGE_CONFIG } from '../db/query-utils.js';
import { createChildLogger } from '../logger.js';
import { getAppVersion } from '../version.js';
import { formatTokens, friendlyModel, type MetricsBucket, relativeTime } from './snapshot-formatters.js';
import type {
  DataSources,
  Detail,
  InternalRange,
  ModelTokenUsage,
  SnapshotData,
  SnapshotSession,
} from './snapshot-types.js';

const log = createChildLogger('snapshot-data');

// ─── Constants ───────────────────────────────────────────────────

const RANGE_DISPLAY: Record<string, string> = {
  THIRTY_MIN: '30m',
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

function buildSession(
  s: Record<string, unknown>,
  includeSubs: boolean,
  turnCountMap?: Map<string, number>,
): SnapshotSession {
  const model = (s.model as string) ?? '';
  const totalTokens = (s.totalTokens as number) ?? 0;
  const subs = (s.subAgents as Record<string, unknown>[]) ?? [];
  const lookupKey = (s.key as string) ?? (s.name as string) ?? '';
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
    turnCount: turnCountMap?.get(lookupKey) ?? 0,
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
  opts: { detail: Detail; range: InternalRange },
): Promise<SnapshotData> {
  const { detail, range } = opts;

  // 1. Fetch raw data (parallel)
  const t0 = performance.now();
  const [gw, channels] = await Promise.all([sources.getGateway(), sources.getChannels()]);
  const t1 = performance.now();
  log.debug({ fetchMs: Math.round(t1 - t0) }, 'snapshot data fetch');
  const rawSessions = sources.getSessions() as Record<string, unknown>[];
  const metrics = sources.getMetrics(range);

  // 2. Gateway
  const gateway: SnapshotData['gateway'] = {
    status: gw.running ? 'up' : 'down',
    version: getAppVersion(),
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

  // 4. Buckets and range timestamps
  const buckets = metrics.buckets as MetricsBucket[];
  const endTs = new Date().toISOString();
  const rangeConfig = RANGE_CONFIG[range];
  const startTs = new Date(Date.now() - rangeConfig.rangeMinutes * 60_000).toISOString();

  // 5. Per-model token usage
  const rawModelTokens = sources.getModelTokenUsage(startTs, endTs);
  const totalModelK = rawModelTokens.reduce((s, m) => s + m.tokensK, 0);
  const top5 = rawModelTokens.slice(0, 5);
  const rest = rawModelTokens.slice(5);
  const tokensByModel: ModelTokenUsage[] = top5.map((m) => ({
    model: m.model,
    modelDisplay: friendlyModel(m.model),
    tokensK: m.tokensK,
    percent: totalModelK > 0 ? Math.round((m.tokensK / totalModelK) * 100) : 0,
  }));

  if (rest.length > 0) {
    const otherK = rest.reduce((s, m) => s + m.tokensK, 0);
    tokensByModel.push({
      model: 'other',
      modelDisplay: 'Other',
      tokensK: otherK,
      percent: totalModelK > 0 ? Math.round((otherK / totalModelK) * 100) : 0,
    });
  }

  const pctSum = tokensByModel.reduce((s, m) => s + m.percent, 0);
  if (pctSum !== 100 && tokensByModel.length > 0 && totalModelK > 0) {
    tokensByModel[0].percent += 100 - pctSum;
  }

  // 6. Token trend
  const trendPercent = sources.getTokenTrend(rangeConfig.rangeMinutes, endTs);
  let tokensTrend: string | undefined;
  if (trendPercent !== null && trendPercent !== 0) {
    const arrow = trendPercent > 0 ? '↑' : '↓';
    const prefix = Math.abs(trendPercent) > 100 ? '⚠️ ' : '';
    tokensTrend = `${prefix}${arrow}${Math.abs(trendPercent)}%`;
  }

  // 7. Turn counts
  const turnData = sources.getTurnCounts(startTs, endTs);
  const turnBySession = new Map(turnData.bySession.map((r) => [r.sessionKey, r.turns]));

  // 8. Base result (compact)
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
    tokensByModel,
    tokensTrend,
  };

  // 9. Detail augmentation
  if (detail === 'standard' || detail === 'full') {
    result.buckets = buckets;
  }

  const activeSorted = [...rawSessions]
    .filter((s) => (s.status as string)?.toLowerCase() === 'active')
    .sort((a, b) => ((b.totalTokens as number) ?? 0) - ((a.totalTokens as number) ?? 0));

  if (detail === 'standard') {
    result.sessions = activeSorted.slice(0, 8).map((s) => buildSession(s, false, turnBySession));
    const errResult = sources.getRecentErrors(3);
    result.recentErrors = Array.isArray(errResult)
      ? errResult
      : ((errResult as unknown as { events: typeof result.recentErrors }).events ?? []);
  }

  if (detail === 'full') {
    result.sessions = activeSorted.slice(0, 20).map((s) => buildSession(s, true, turnBySession));
    const errResult = sources.getRecentErrors(5);
    result.recentErrors = Array.isArray(errResult)
      ? errResult
      : ((errResult as unknown as { events: typeof result.recentErrors }).events ?? []);
  }

  return result;
}
