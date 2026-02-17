export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;

export function relativeTime(epochMs: number, t: TranslateFn): string {
  const diff = Date.now() - epochMs;
  if (diff < 60_000) return t('time.justNow');
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return t('time.mAgo', { n: mins });
  const hours = Math.floor(mins / 60);
  if (hours < 24) return t('time.hAgo', { n: hours });
  const days = Math.floor(hours / 24);
  return t('time.dAgo', { n: days });
}
