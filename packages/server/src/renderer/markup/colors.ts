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
  uptimeMap: Record<string, string>;
  gatewayDownBg: string;
  gatewayDownBorder: string;
}

export const DARK: ColorScheme = {
  bg: '#09090b',
  cardBg: 'rgba(24,24,27,0.85)',
  border: 'rgba(63,63,70,0.6)',
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
  modelColors: ['#34d399', '#38bdf8', '#fbbf24', '#a78bfa', '#f472b6'],
  trackBg: '#27272a',
  tagModel: { bg: 'rgba(56,189,248,0.08)', color: 'rgba(56,189,248,0.8)', border: 'rgba(56,189,248,0.12)' },
  tagChannel: { bg: 'rgba(167,139,250,0.08)', color: 'rgba(167,139,250,0.8)', border: 'rgba(167,139,250,0.12)' },
  tagSub: { bg: 'rgba(52,211,153,0.08)', color: 'rgba(52,211,153,0.7)', border: 'rgba(52,211,153,0.12)' },
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
  uptimeMap: { up: '#059669', degraded: '#d97706', down: '#dc2626' },
  gatewayDownBg: 'rgba(220,38,38,0.06)',
  gatewayDownBorder: 'rgba(220,38,38,0.2)',
};

export function getColors(theme: 'dark' | 'light'): ColorScheme {
  return theme === 'dark' ? DARK : LIGHT;
}
