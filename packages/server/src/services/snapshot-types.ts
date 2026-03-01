import { resolveLocale } from '../renderer/i18n/index.js';
import type { MetricsBucket } from './snapshot-formatters.js';

const VALID_DETAILS = ['compact', 'standard', 'full'] as const;
const VALID_FORMATS = ['png', 'json', 'svg'] as const;
const VALID_RANGES = ['30m', '1h', '6h', '12h', '24h'] as const;
const VALID_THEMES = ['dark', 'light'] as const;

export type Detail = (typeof VALID_DETAILS)[number];
export type Format = (typeof VALID_FORMATS)[number];
export type Range = (typeof VALID_RANGES)[number];
export type Theme = (typeof VALID_THEMES)[number];
export type Lang = 'en' | 'zh';

export interface SnapshotRequest {
  detail: Detail;
  format: Format;
  range: Range;
  theme: Theme;
  lang: Lang;
}

/** Internal range keys used by MetricsAggregator / query-utils */
export type InternalRange = 'THIRTY_MIN' | 'ONE_HOUR' | 'SIX_HOUR' | 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR';

export const RANGE_MAP: Record<Range, InternalRange> = {
  '30m': 'THIRTY_MIN',
  '1h': 'ONE_HOUR',
  '6h': 'SIX_HOUR',
  '12h': 'TWELVE_HOUR',
  '24h': 'TWENTY_FOUR_HOUR',
};

function validate<T extends string>(value: unknown, valid: readonly T[], field: string, fallback: T): T {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== 'string' || !(valid as readonly string[]).includes(value)) {
    throw new Error(`Invalid ${field}: ${value}. Must be one of: ${valid.join(', ')}`);
  }
  return value as T;
}

function normalizeLang(value: unknown): Lang {
  if (value === undefined || value === null) {
    return 'en';
  }
  if (typeof value !== 'string') {
    return 'en';
  }
  return resolveLocale(value) as Lang;
}

export function parseSnapshotRequest(body: Record<string, unknown>): SnapshotRequest {
  return {
    detail: validate(body.detail, VALID_DETAILS, 'detail', 'standard'),
    format: validate(body.format, VALID_FORMATS, 'format', 'png'),
    range: validate(body.range, VALID_RANGES, 'range', '24h'),
    theme: validate(body.theme, VALID_THEMES, 'theme', 'dark'),
    lang: normalizeLang(body.lang),
  };
}

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
    buckets: MetricsBucket[];
  };
  getRecentErrors: (limit: number) => {
    events: { timestamp: string; type: string; module: string; message: string }[];
    total: number;
    counts: { error: number; warning: number; restart: number };
  };
  getModelTokenUsage: (startTs: string, endTs: string) => { model: string; tokensK: number }[];
  getTokenTrend: (rangeMinutes: number, endTs: string) => number | null;
  getTurnCounts: (
    startTs: string,
    endTs: string,
  ) => {
    total: number;
    bySession: Array<{ sessionKey: string; turns: number }>;
  };
  getCompanionDays: () => Promise<number>;
  getTotalConversations: () => number;
  getRangeMessageCount: (startTs: string, endTs: string) => number;
}

// ─── Output Types ────────────────────────────────────────────────

export interface ModelTokenUsage {
  model: string;
  modelDisplay: string;
  tokensK: number;
  percent: number;
}

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
  turnCount: number;
  subAgentCount: number;
  subAgents?: { name: string; status: string; completed: boolean; updatedAt: string }[];
}

export interface SnapshotData {
  gateway: {
    status: 'up' | 'down' | 'connecting';
    version: string;
    uptime: string;
    cpu: number;
    memoryMB: number;
  } | null;
  channels: { name: string; provider: string; connected: boolean; latencyMs: number | null }[] | null;
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
    totalMessages: number;
  } | null;
  tokensByModel: ModelTokenUsage[] | null;
  tokensTrend?: string;
  buckets?: MetricsBucket[] | null;
  sessions?: SnapshotSession[] | null;
  recentErrors?: { timestamp: string; type: string; module: string; message: string }[] | null;
  companionDays: number | null;
  hostname: string;
  totalConversations: number | null;
  _meta?: { degradedSources: string[] };
}
