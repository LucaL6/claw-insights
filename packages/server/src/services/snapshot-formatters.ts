// ─── Formatting ──────────────────────────────────────────────────

export function formatTokens(n: number): string {
  if (n >= 1_000_000) {return `${(n / 1_000_000).toFixed(2)}M`;}
  if (n >= 1_000) {return `${(n / 1_000).toFixed(1)}k`;}
  return String(n);
}

export function friendlyModel(model: string): string {
  // "anthropic/claude-opus-4-6" → "Opus 4.6"
  const last = model.includes('/') ? model.split('/').pop()! : model;
  const stripped = last.replace(/^claude-/, '');
  const parts = stripped.split('-');
  if (parts.length === 0) {return model;}
  const name = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const version = parts.slice(1).join('.');
  return version ? `${name} ${version}` : name;
}

export function normalize(values: number[]): number[] {
  if (values.length === 0) {return [];}
  const max = Math.max(...values);
  if (max === 0) {return values.map(() => 0);}
  return values.map((v) => Math.round((v / max) * 100));
}

export function relativeTime(input: number | string): string {
  const ts = typeof input === 'number' ? input : new Date(input).getTime();
  if (!ts || isNaN(ts)) {return '—';}
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) {return 'just now';}
  if (mins < 60) {return `${mins}m ago`;}
  const hours = Math.floor(mins / 60);
  if (hours < 24) {return `${hours}h ago`;}
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ─── Sampling ────────────────────────────────────────────────────

/**
 * Point-sample: pick `count` evenly-spaced items from `arr`.
 * Use for non-aggregatable data (e.g. uptime status strings).
 */
export function sample<T>(arr: T[], count: number): T[] {
  if (arr.length <= count) {return arr;}
  const step = (arr.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => arr[Math.round(i * step)]);
}

/** Shape of a metrics bucket used for sparkline aggregation. */
export interface MetricsBucket {
  sessions?: number;
  tokensK?: number;
  tokens?: number;
  errors?: number;
  warnings?: number;
  uptimePercent?: number;
}

/**
 * Aggregate-downsample: merge `arr` into `count` bins.
 * Each bin uses SUM for additive fields (tokens, errors) and
 * MAX for peak fields (sessions). Preserves totals.
 */
export function aggregateSample(arr: MetricsBucket[], count: number): MetricsBucket[] {
  if (count <= 0 || arr.length === 0) {return [];}
  if (arr.length <= count) {return arr;}
  const binSize = arr.length / count;
  const result: MetricsBucket[] = [];
  for (let i = 0; i < count; i++) {
    const start = Math.floor(i * binSize);
    const end = Math.floor((i + 1) * binSize);
    const slice = arr.slice(start, end);
    result.push({
      sessions: Math.max(...slice.map((b) => b.sessions ?? 0)),
      tokensK: slice.reduce((s, b) => s + (b.tokensK ?? b.tokens ?? 0), 0),
      errors: slice.reduce((s, b) => s + (b.errors ?? 0), 0),
      warnings: slice.reduce((s, b) => s + (b.warnings ?? 0), 0),
      uptimePercent: Math.min(...slice.map((b) => b.uptimePercent ?? 100)),
    });
  }
  return result;
}

export function uptimeStatus(percent: number): 'up' | 'degraded' | 'down' {
  if (percent >= 99) {return 'up';}
  if (percent >= 90) {return 'degraded';}
  return 'down';
}
