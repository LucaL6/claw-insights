/** Color palette for consistent chart colors */
export const COLORS = {
  emerald: '#34d399',
  emeraldDark: '#059669',
  sky: '#38bdf8',
  violet: '#a78bfa',
  amber: '#fbbf24',
  red: '#ef4444',
  orange: '#f97316',
  zinc: '#3f3f46',
} as const;

/** Model family → color mapping for stacked charts */
export const MODEL_COLORS: Record<string, string> = {
  'opus-4-6': '#38bdf8', // sky-400 (Opus 4.6)
  'opus-4-5': '#7dd3fc', // sky-300 (Opus 4.5)
  opus: '#38bdf8', // sky-400 (generic Opus fallback)
  sonnet: '#a78bfa', // violet-400
  haiku: '#34d399', // emerald-400
  '5.3-codex-spark': '#fbbf24', // amber-400 (Codex Spark)
  '5.3-codex': '#f97316', // orange-500 (primary GPT)
  '5.2-codex': '#fdba74', // orange-300 (secondary GPT)
  gpt: '#fb923c', // orange-400 (generic GPT fallback)
  minimax: '#2dd4bf', // teal-400 (was emerald, conflicted with haiku)
};

/** Pre-sorted entries: longest key first so specific matches win over generic */
const COLOR_ENTRIES = Object.entries(MODEL_COLORS).sort((a, b) => b[0].length - a[0].length);

export function getModelColor(model: string): string {
  const lower = model.toLowerCase();
  for (const [key, color] of COLOR_ENTRIES) {
    if (lower.includes(key)) {
      return color;
    }
  }
  return '#71717a'; // zinc-500
}

export function shortModelName(model: string): string {
  const claude = model.match(/^(?:anthropic\/)?claude-(\w+)-(\d+)(?:-(\d+))?/);
  if (claude) {
    const family = claude[1].charAt(0).toUpperCase() + claude[1].slice(1);
    const version = claude[3] ? `${claude[2]}.${claude[3]}` : claude[2];
    return `${family} ${version}`;
  }
  const raw = model.includes('/') ? (model.split('/').pop() ?? model) : model;
  const codex = raw.match(/^gpt-([\d.]+)-codex(?:-(spark))?$/i);
  if (codex) {
    return `Codex ${codex[1]}${codex[2] ? ' Spark' : ''}`;
  }
  const gpt = raw.match(/^gpt-([a-z\d.]+)(?:-([a-z\d-]+))?$/i);
  if (gpt) {
    const suffix = gpt[2]
      ? ` ${gpt[2]
          .split('-')
          .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
          .join(' ')}`
      : '';
    return `GPT ${gpt[1]}${suffix}`;
  }
  return model.length > 15 ? model.slice(0, 15) + '…' : model;
}
