const ALLOWED_TIME_PRESETS = new Set(['THIRTY_MIN', 'ONE_HOUR', 'SIX_HOUR', 'TWELVE_HOUR', 'TWENTY_FOUR_HOUR']);

interface FilterDefaults {
  readonly timeRange?: {
    readonly from?: number | null;
    readonly to?: number | null;
    readonly preset?: string | null;
  } | null;
  readonly tags?: readonly string[] | null;
}

export interface QueryContextData {
  readonly trace?: {
    readonly requestId?: string | null;
    readonly traceId?: string | null;
  };
  readonly preferences?: {
    readonly locale?: string | null;
    readonly timezone?: string | null;
  };
  readonly defaults?: FilterDefaults;
  readonly extensions?: unknown;
}

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
};

const normalizeTimeRange = (value: unknown): FilterDefaults['timeRange'] => {
  const obj = asRecord(value);
  if (!obj) {
    return undefined;
  }

  const from = typeof obj.from === 'number' ? obj.from : undefined;
  const to = typeof obj.to === 'number' ? obj.to : undefined;
  const preset = typeof obj.preset === 'string' && ALLOWED_TIME_PRESETS.has(obj.preset) ? obj.preset : undefined;

  if (from == null && to == null && preset == null) {
    return undefined;
  }

  return {
    ...(from != null ? { from } : {}),
    ...(to != null ? { to } : {}),
    ...(preset != null ? { preset } : {}),
  };
};

const normalizeDefaults = (value: unknown): FilterDefaults | undefined => {
  const obj = asRecord(value);
  if (!obj) {
    return undefined;
  }

  const timeRange = normalizeTimeRange(obj.timeRange);
  const tags = Array.isArray(obj.tags) ? obj.tags.filter((v): v is string => typeof v === 'string') : undefined;

  if (!timeRange && (!tags || tags.length === 0)) {
    return undefined;
  }

  return {
    ...(timeRange ? { timeRange } : {}),
    ...(tags && tags.length > 0 ? { tags } : {}),
  };
};

/**
 * Extract typed query context from raw resolver input.
 *
 * Normalization rules:
 * - Ignore malformed branches (non-object trace/preferences/defaults)
 * - Keep only known scalar fields
 * - Whitelist defaults.timeRange.preset against enum value set
 */
export const extractQueryContext = (raw: Record<string, unknown> | null | undefined): QueryContextData => {
  if (!raw) {
    return {};
  }

  const result: QueryContextData = {};

  const trace = asRecord(raw.trace);
  if (trace) {
    result.trace = {
      ...(typeof trace.requestId === 'string' ? { requestId: trace.requestId } : {}),
      ...(typeof trace.traceId === 'string' ? { traceId: trace.traceId } : {}),
    };
  }

  const preferences = asRecord(raw.preferences);
  if (preferences) {
    result.preferences = {
      ...(typeof preferences.locale === 'string' ? { locale: preferences.locale } : {}),
      ...(typeof preferences.timezone === 'string' ? { timezone: preferences.timezone } : {}),
    };
  }

  const defaults = normalizeDefaults(raw.defaults);
  if (defaults) {
    result.defaults = defaults;
  }

  if (raw.extensions !== undefined) {
    result.extensions = raw.extensions;
  }

  return result;
};
