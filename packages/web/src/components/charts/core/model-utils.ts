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
  opus: '#38bdf8', // sky-400
  sonnet: '#a78bfa', // violet-400
  haiku: '#34d399', // emerald-400
  '5.3-codex': '#f97316', // orange-500 (primary GPT)
  '5.2-codex': '#fdba74', // orange-300 (secondary GPT)
  gpt: '#fb923c', // orange-400 (generic GPT fallback)
  minimax: '#34d399', // emerald-400
};

/** Pre-sorted entries: longest key first so specific matches win over generic */
const COLOR_ENTRIES = Object.entries(MODEL_COLORS).sort((a, b) => b[0].length - a[0].length);

export function getModelColor(model: string): string {
  const lower = model.toLowerCase();
  for (const [key, color] of COLOR_ENTRIES) {
    if (lower.includes(key)) return color;
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
  const gpt = model.match(/^(?:openai\/)?gpt-([\d.]+)/);
  if (gpt) return `GPT ${gpt[1]}`;
  return model.length > 15 ? model.slice(0, 15) + '…' : model;
}
