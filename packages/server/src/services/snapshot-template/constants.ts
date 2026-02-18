// ─── Colors ──────────────────────────────────────────────────────

export const COLORS = {
  // Zinc scale (background/border/text)
  bg: '#09090b',
  cardBg: 'rgba(24,24,27,0.6)',
  cardBgSubtle: 'rgba(24,24,27,0.4)',
  cardBgFaint: 'rgba(24,24,27,0.3)',
  border: '#3f3f46',
  borderAlpha: 'rgba(63,63,70,0.6)',
  textPrimary: '#f4f4f5',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  textDim: '#52525b',
  trackBg: '#27272a',

  // Semantic
  emerald: '52,211,153',
  emeraldHex: '#34d399',
  red: '248,113,113',
  redHex: '#f87171',
  cyan: '34,211,238',
  sky: '56,189,248',
  violet: '167,139,250',
  amber: '234,179,8',
  amberHex: '#fbbf24',
  orange: '#f97316',

  // Tag schemes
  tagModel: { bg: 'rgba(56,189,248,0.08)', text: 'rgba(56,189,248,0.8)', border: 'rgba(56,189,248,0.12)' },
  tagChannel: { bg: 'rgba(167,139,250,0.08)', text: 'rgba(167,139,250,0.8)', border: 'rgba(167,139,250,0.12)' },
  tagSub: { bg: 'rgba(52,211,153,0.08)', text: 'rgba(52,211,153,0.7)', border: 'rgba(52,211,153,0.12)' },

  // Active session border
  activeBorder: 'rgba(16,185,129,0.2)',
} as const;

// ─── Shadow ──────────────────────────────────────────────────────

export const CARD_SHADOW = 'box-shadow:0 1px 3px rgba(0,0,0,0.4)';

// ─── SVG ─────────────────────────────────────────────────────────

export const LIGHTHOUSE_SVG = `<svg width="20" height="20" viewBox="0 0 48 48" fill="none" stroke="${COLORS.orange}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="14" y1="42" x2="34" y2="42"/><path d="M20 42 L22 18 H26 L28 42"/><rect x="21" y="12" width="6" height="6" rx="1" fill="${COLORS.orange}" opacity="0.2"/><path d="M21 12 Q24 8 27 12"/><line x1="16" y1="10" x2="10" y2="7" opacity="0.5"/><line x1="15" y1="14" x2="8" y2="14" opacity="0.5"/><line x1="32" y1="10" x2="38" y2="7" opacity="0.5"/><line x1="33" y1="14" x2="40" y2="14" opacity="0.5"/></svg>`;

// ─── CSS ─────────────────────────────────────────────────────────

export const SHARED_CSS = `
  .sparkline { display:flex; align-items:flex-end; gap:2px; height:100% }
  .sparkline .bar { flex:1; border-radius:1px; min-width:3px }
  @keyframes pulse-dot { 0%,100%{opacity:1} 50%{opacity:0.4} }
  .pulse { animation: pulse-dot 2s ease-in-out infinite }
  .progress-track { background:rgba(255,255,255,0.08); border-radius:3px; height:5px }
  .progress-fill { border-radius:3px; height:5px }
  .tree-line { border-left: 1.5px solid rgba(34,211,238,0.2) }
  .tree-branch::before { content:''; position:absolute; left:-12px; top:50%; width:10px; height:1.5px; background:rgba(34,211,238,0.2) }
`;

export const TAILWIND_CDN = `<script src="https://cdn.tailwindcss.com"></script>`;
export const FONT_LINK = `<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">`;
export const TAILWIND_CONFIG = `<script>tailwind.config = { theme: { extend: { fontFamily: { sans: ['IBM Plex Sans','system-ui','sans-serif'], mono: ['JetBrains Mono','ui-monospace','monospace'] } } } }</script>`;

// ─── Helpers ─────────────────────────────────────────────────────

export function esc(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function sparklineHtml(points: number[], color: string): string {
  if (!points || !points.length) return '';
  const max = Math.max(...points, 1);
  return (
    '<div class="sparkline">' +
    points
      .map((v, i) => {
        const h = Math.max(2, (v / max) * 100);
        const op = i === points.length - 1 ? '0.8' : '0.7';
        return `<div class="bar" style="height:${h}%;background:rgba(${color},${op})"></div>`;
      })
      .join('') +
    '</div>'
  );
}

export function uptimeStripHtml(states: ('up' | 'degraded' | 'down')[]): string {
  if (!states || !states.length) return '';
  return (
    '<div class="sparkline">' +
    states
      .map((st) => {
        const c = st === 'up' ? COLORS.emerald : st === 'degraded' ? COLORS.amber : COLORS.red;
        return `<div class="bar" style="height:100%;background:rgba(${c},0.6)"></div>`;
      })
      .join('') +
    '</div>'
  );
}

export function bucketChartHtml(points: number[], gradientFrom: string, gradientTo: string): string {
  if (!points || !points.length) return '';
  const max = Math.max(...points, 1);
  return (
    '<div class="sparkline">' +
    points
      .map((v) => {
        const h = Math.max(2, (v / max) * 100);
        return `<div class="bar" style="height:${h}%;background:linear-gradient(to top, ${gradientFrom}, ${gradientTo})"></div>`;
      })
      .join('') +
    '</div>'
  );
}

export function tag(text: string, scheme: { bg: string; text: string; border: string }): string {
  return `<span class="px-1.5 py-0.5 text-[10px] rounded font-medium" style="background:${scheme.bg};color:${scheme.text};border:1px solid ${scheme.border}">${esc(text)}</span>`;
}
