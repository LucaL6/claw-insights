type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

const defaultT: TranslateFn = (key, params) => {
  const templates: Record<string, string> = {
    'time.justNow': 'just now',
    'time.mAgo': '{n}m ago',
    'time.hAgo': '{n}h ago',
    'time.dAgo': '{n}d ago',
  };
  let text = templates[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }
  return text;
};

export function relativeTime(epochMs: number, t: TranslateFn = defaultT): string {
  const diff = Date.now() - epochMs;
  if (diff < 60_000) return t('time.justNow');
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return t('time.mAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('time.hAgo', { n: hours });
  const days = Math.floor(hours / 24);
  return t('time.dAgo', { n: days });
}
