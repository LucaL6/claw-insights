import { hostname as osHostname } from 'node:os';

import { RANGE_CONFIG } from '../db/query-utils.js';
import { createChildLogger } from '../logger.js';
import { getAppVersion } from '../version.js';
import { formatTokens, friendlyModel, relativeTime } from './snapshot-formatters.js';
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

// ─── Safe Collect Helper ─────────────────────────────────────────

async function safeCollect<T>(name: string, fn: () => T | Promise<T>, degraded: string[]): Promise<T | null> {
  try {
    return await fn();
  } catch (err) {
    log.warn({ err, source: name }, 'snapshot source failed, using fallback');
    degraded.push(name);
    return null;
  }
}

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
    updatedAt: relativeTime(
      typeof s.updatedAt === 'string' || typeof s.updatedAt === 'number' ? s.updatedAt : new Date().toISOString(),
    ),
    turnCount: turnCountMap?.get(lookupKey) ?? 0,
    subAgentCount: subs.length,
  };
  if (includeSubs && subs.length > 0) {
    session.subAgents = subs.map((a) => ({
      name: (a.displayName as string) ?? (a.name as string) ?? '',
      status: (a.status as string) ?? '',
      completed: (a.completed as boolean) ?? false,
      updatedAt: relativeTime(
        typeof a.updatedAt === 'string' || typeof a.updatedAt === 'number' ? a.updatedAt : new Date().toISOString(),
      ),
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
  const degraded: string[] = [];
  const t0 = performance.now();

  // 1. Gateway (if fails, channels also null — cascade)
  const gw = await safeCollect('gateway', () => sources.getGateway(), degraded);
  let channels: Awaited<ReturnType<typeof sources.getChannels>> | null = null;
  if (gw) {
    channels = await safeCollect('channels', () => sources.getChannels(), degraded);
  } else {
    degraded.push('channels'); // cascade: gateway down → channels unavailable
  }

  // 2. Gateway data
  const gateway: SnapshotData['gateway'] = gw
    ? {
        status: gw.running ? 'up' : 'down',
        version: getAppVersion(),
        uptime: gw.uptime,
        cpu: (gw.cpu as number) ?? 0,
        memoryMB: (gw.memoryMB as number) ?? 0,
      }
    : null;

  // 3. Metrics
  const metrics = await safeCollect('metrics', () => sources.getMetrics(range), degraded);

  // 4. Sessions
  const rawSessions = await safeCollect('sessions', () => sources.getSessions() as Record<string, unknown>[], degraded);

  // 5. Summary (depends on metrics + sessions)
  let summary: SnapshotData['summary'] = null;
  if (metrics) {
    const tokensRaw = metrics.totalTokensK * 1000;
    const activeSessions = rawSessions
      ? rawSessions.filter((s) => (s.status as string)?.toLowerCase() === 'active').length
      : 0;
    summary = {
      activeSessions,
      totalSessions: rawSessions?.length ?? 0,
      tokens: Math.round(tokensRaw),
      tokensDisplay: formatTokens(tokensRaw),
      errors: metrics.totalErrors,
      warnings: metrics.totalWarnings,
      uptimePercent: metrics.uptimePercent,
      totalMessages: 0,
    };
  }

  // 6. Buckets and range timestamps
  const buckets = metrics?.buckets ?? null;
  const endTs = new Date().toISOString();
  const rangeConfig = RANGE_CONFIG[range];
  const startTs = new Date(Date.now() - rangeConfig.rangeMinutes * 60_000).toISOString();

  // 6b. Range-scoped message count
  if (summary) {
    summary.totalMessages =
      (await safeCollect('messageCount', () => sources.getRangeMessageCount(startTs, endTs), degraded)) ?? 0;
  }

  // 7. Per-model token usage
  const tokensByModel = await safeCollect(
    'tokensByModel',
    () => {
      const rawModelTokens = sources.getModelTokenUsage(startTs, endTs);
      const totalModelK = rawModelTokens.reduce((s, m) => s + m.tokensK, 0);
      const top5 = rawModelTokens.slice(0, 5);
      const rest = rawModelTokens.slice(5);
      const result: ModelTokenUsage[] = top5.map((m) => ({
        model: m.model,
        modelDisplay: friendlyModel(m.model),
        tokensK: m.tokensK,
        percent: totalModelK > 0 ? Math.round((m.tokensK / totalModelK) * 100) : 0,
      }));

      if (rest.length > 0) {
        const otherK = rest.reduce((s, m) => s + m.tokensK, 0);
        result.push({
          model: 'other',
          modelDisplay: 'Other',
          tokensK: otherK,
          percent: totalModelK > 0 ? Math.round((otherK / totalModelK) * 100) : 0,
        });
      }

      const pctSum = result.reduce((s, m) => s + m.percent, 0);
      if (pctSum !== 100 && result.length > 0 && totalModelK > 0) {
        result[0].percent += 100 - pctSum;
      }
      return result;
    },
    degraded,
  );

  // 8. Token trend
  const trendPercent = await safeCollect(
    'tokenTrend',
    () => sources.getTokenTrend(rangeConfig.rangeMinutes, endTs),
    degraded,
  );
  let tokensTrend: string | undefined;
  if (trendPercent != null && trendPercent !== 0) {
    const arrow = trendPercent > 0 ? '↑' : '↓';
    const prefix = Math.abs(trendPercent) > 100 ? '⚠️ ' : '';
    tokensTrend = `${prefix}${arrow}${Math.abs(trendPercent)}%`;
  }

  // 9. Turn counts
  const turnData = await safeCollect('turnCounts', () => sources.getTurnCounts(startTs, endTs), degraded);
  const turnBySession = turnData
    ? new Map(turnData.bySession.map((r) => [r.sessionKey, r.turns]))
    : new Map<string, number>();

  // 10. Companion days + total conversations
  const companionDays = await safeCollect('companionDays', () => sources.getCompanionDays(), degraded);
  const totalConversations = await safeCollect('totalConversations', () => sources.getTotalConversations(), degraded);

  // 11. Base result
  const result: SnapshotData = {
    gateway,
    channels: channels
      ? channels.map((c) => ({
          name: CHANNEL_SHORT[c.provider?.toLowerCase()] ?? c.name,
          provider: c.provider,
          connected: c.connected,
          latencyMs: c.latencyMs,
        }))
      : null,
    timestamp: new Date().toISOString(),
    range: RANGE_DISPLAY[range] ?? range,
    time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
    summary,
    tokensByModel: tokensByModel ?? null,
    tokensTrend,
    companionDays: companionDays ?? null,
    hostname: osHostname(),
    totalConversations: totalConversations ?? null,
    _meta: { degradedSources: degraded },
  };

  // 12. Detail augmentation
  if (detail === 'standard' || detail === 'full') {
    result.buckets = buckets;
  }

  if (rawSessions) {
    const activeSorted = [...rawSessions]
      .filter((s) => (s.status as string)?.toLowerCase() === 'active')
      .sort((a, b) => ((b.totalTokens as number) ?? 0) - ((a.totalTokens as number) ?? 0));

    if (detail === 'standard') {
      result.sessions = activeSorted.slice(0, 8).map((s) => buildSession(s, false, turnBySession));
      const errResult = await safeCollect('recentErrors', () => sources.getRecentErrors(3), degraded);
      result.recentErrors = errResult?.events ?? null;
    }

    if (detail === 'full') {
      result.sessions = activeSorted.slice(0, 20).map((s) => buildSession(s, true, turnBySession));
      const errResult = await safeCollect('recentErrors', () => sources.getRecentErrors(5), degraded);
      result.recentErrors = errResult?.events ?? null;
    }
  } else {
    result.sessions = null;
    result.recentErrors = null;
  }

  const totalMs = Math.round(performance.now() - t0);
  log.debug({ totalMs, degradedSources: degraded }, 'snapshot data built');

  return result;
}
