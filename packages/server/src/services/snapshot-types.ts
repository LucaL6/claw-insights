const VALID_DETAILS = ['compact', 'standard', 'full'] as const;
const VALID_FORMATS = ['png', 'json', 'svg'] as const;
const VALID_RANGES = ['1h', '6h', '12h', '24h'] as const;
const VALID_THEMES = ['dark', 'light'] as const;
const VALID_LANGS = ['en', 'zh'] as const;
const VALID_LAYOUTS = ['desktop', 'mobile'] as const;
const VALID_SECTIONS = ['dashboard', 'logs'] as const;

export type Detail = (typeof VALID_DETAILS)[number];
export type Format = (typeof VALID_FORMATS)[number];
export type Range = (typeof VALID_RANGES)[number];
export type Theme = (typeof VALID_THEMES)[number];
export type Lang = (typeof VALID_LANGS)[number];
export type Layout = (typeof VALID_LAYOUTS)[number];
export type Section = (typeof VALID_SECTIONS)[number];

export interface SnapshotRequest {
  layout: Layout;
  detail: Detail;
  format: Format;
  range: Range;
  theme: Theme;
  lang: Lang;
  section: Section;
}

/** Internal range keys used by MetricsAggregator / query-utils */
export type InternalRange = 'ONE_HOUR' | 'SIX_HOUR' | 'TWELVE_HOUR' | 'TWENTY_FOUR_HOUR';

export const RANGE_MAP: Record<Range, InternalRange> = {
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

export function parseSnapshotRequest(body: Record<string, unknown>): SnapshotRequest {
  return {
    layout: validate(body.layout, VALID_LAYOUTS, 'layout', 'desktop'),
    detail: validate(body.detail, VALID_DETAILS, 'detail', 'standard'),
    format: validate(body.format, VALID_FORMATS, 'format', 'png'),
    range: validate(body.range, VALID_RANGES, 'range', '6h'),
    theme: validate(body.theme, VALID_THEMES, 'theme', 'dark'),
    lang: validate(body.lang, VALID_LANGS, 'lang', 'en'),
    section: validate(body.section, VALID_SECTIONS, 'section', 'dashboard'),
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
