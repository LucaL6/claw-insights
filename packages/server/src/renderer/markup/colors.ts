export interface ColorScheme {
  bg: string;
  cardBg: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  textDim: string;
  emerald: string;
  emeraldBg: string;
  red: string;
  redBg: string;
  cyan: string;
  sky: string;
  violet: string;
  amber: string;
  orange: string;
  modelColors: string[];
  trackBg: string;
  tagModel: { bg: string; color: string; border: string };
  tagChannel: { bg: string; color: string; border: string };
  tagSub: { bg: string; color: string; border: string };
  glassBg: string;
  glassBorder: string;
  glassDivider: string;
  onlineDot: string;
  onlineGlow: string;
  accentIndigo: string;
  modelGradients: [string, string][];
  trendBadge: { bg: string; color: string; border: string };
  rangePill: { bg: string; color: string; border: string };
  miniBarGradient: [string, string];
  uptimeMap: Record<string, string>;
  gatewayDownBg: string;
  gatewayDownBorder: string;
}

export const DARK: ColorScheme = {
  bg: '#0a0a0f',
  cardBg: 'rgba(24,24,27,0.85)',
  border: 'rgba(255,255,255,0.04)',
  textPrimary: '#f4f4f5',
  textSecondary: '#a1a1aa',
  textMuted: '#71717a',
  textDim: '#52525b',
  emerald: '#34d399',
  emeraldBg: 'rgba(52,211,153,0.15)',
  red: '#ef4444',
  redBg: 'rgba(239,68,68,0.15)',
  cyan: '#22d3ee',
  sky: '#38bdf8',
  violet: '#a78bfa',
  amber: '#fbbf24',
  orange: '#f97316',
  modelColors: ['#818cf8', '#22d3ee', '#fbbf24', '#a78bfa', '#71717a'],
  trackBg: 'rgba(255,255,255,0.04)',
  tagModel: { bg: 'rgba(99,102,241,0.1)', color: 'rgba(129,140,248,0.9)', border: 'rgba(99,102,241,0.15)' },
  tagChannel: { bg: 'rgba(167,139,250,0.08)', color: 'rgba(196,181,253,0.9)', border: 'rgba(167,139,250,0.12)' },
  tagSub: { bg: 'rgba(52,211,153,0.08)', color: 'rgba(52,211,153,0.7)', border: 'rgba(52,211,153,0.12)' },
  glassBg: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.06)',
  glassDivider: 'rgba(255,255,255,0.06)',
  onlineDot: '#34d399',
  onlineGlow: 'rgba(52,211,153,0.4)',
  accentIndigo: '#a5b4fc',
  modelGradients: [
    ['#6366f1', '#818cf8'],
    ['#06b6d4', '#22d3ee'],
    ['#f59e0b', '#fbbf24'],
    ['#8b5cf6', '#a78bfa'],
    ['#71717a', '#71717a'],
  ],
  trendBadge: { bg: 'rgba(52,211,153,0.1)', color: '#34d399', border: 'rgba(52,211,153,0.15)' },
  rangePill: { bg: 'rgba(255,255,255,0.04)', color: '#71717a', border: 'rgba(255,255,255,0.04)' },
  miniBarGradient: ['#6366f1', '#8b5cf6'],
  uptimeMap: { up: '#34d399', degraded: '#fbbf24', down: '#f87171' },
  gatewayDownBg: 'rgba(239,68,68,0.08)',
  gatewayDownBorder: 'rgba(239,68,68,0.25)',
};

export const LIGHT: ColorScheme = {
  bg: '#fafafa',
  cardBg: 'rgba(255,255,255,0.9)',
  border: 'rgba(228,228,231,0.8)',
  textPrimary: '#18181b',
  textSecondary: '#52525b',
  textMuted: '#a1a1aa',
  textDim: '#d4d4d8',
  emerald: '#059669',
  emeraldBg: 'rgba(5,150,105,0.1)',
  red: '#dc2626',
  redBg: 'rgba(220,38,38,0.1)',
  cyan: '#0891b2',
  sky: '#0284c7',
  violet: '#7c3aed',
  amber: '#d97706',
  orange: '#ea580c',
  modelColors: ['#059669', '#0284c7', '#d97706', '#7c3aed', '#db2777'],
  trackBg: '#e4e4e7',
  tagModel: { bg: 'rgba(2,132,199,0.08)', color: 'rgba(2,132,199,0.9)', border: 'rgba(2,132,199,0.15)' },
  tagChannel: { bg: 'rgba(124,58,237,0.08)', color: 'rgba(124,58,237,0.9)', border: 'rgba(124,58,237,0.15)' },
  tagSub: { bg: 'rgba(5,150,105,0.08)', color: 'rgba(5,150,105,0.8)', border: 'rgba(5,150,105,0.15)' },
  glassBg: 'rgba(0,0,0,0.02)',
  glassBorder: 'rgba(0,0,0,0.06)',
  glassDivider: 'rgba(0,0,0,0.06)',
  onlineDot: '#059669',
  onlineGlow: 'rgba(5,150,105,0.3)',
  accentIndigo: '#6366f1',
  modelGradients: [
    ['#4f46e5', '#6366f1'],
    ['#0891b2', '#06b6d4'],
    ['#d97706', '#f59e0b'],
    ['#7c3aed', '#8b5cf6'],
    ['#a1a1aa', '#a1a1aa'],
  ],
  trendBadge: { bg: 'rgba(5,150,105,0.08)', color: '#059669', border: 'rgba(5,150,105,0.12)' },
  rangePill: { bg: 'rgba(0,0,0,0.03)', color: '#71717a', border: 'rgba(0,0,0,0.06)' },
  miniBarGradient: ['#4f46e5', '#7c3aed'],
  uptimeMap: { up: '#059669', degraded: '#d97706', down: '#dc2626' },
  gatewayDownBg: 'rgba(220,38,38,0.06)',
  gatewayDownBorder: 'rgba(220,38,38,0.2)',
};

export function getColors(theme: 'dark' | 'light'): ColorScheme {
  return theme === 'dark' ? DARK : LIGHT;
}
