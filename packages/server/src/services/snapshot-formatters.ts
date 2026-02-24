// ─── Formatting ──────────────────────────────────────────────────

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function friendlyModel(model: string): string {
  // "anthropic/claude-opus-4-6" → "Opus 4.6"
  const last = model.includes('/') ? model.split('/').pop()! : model;
  const stripped = last.replace(/^claude-/, '');
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

export function sample<T>(arr: T[], count: number): T[] {
  if (arr.length <= count) return arr;
  const step = (arr.length - 1) / (count - 1);
  return Array.from({ length: count }, (_, i) => arr[Math.round(i * step)]);
}

export function uptimeStatus(percent: number): 'up' | 'degraded' | 'down' {
  if (percent >= 99) return 'up';
  if (percent >= 90) return 'degraded';
  return 'down';
}
