export function formatUptime(startedAt: string | null | undefined): string {
  if (!startedAt) return '';
  const ts = new Date(startedAt).getTime();
  if (Number.isNaN(ts)) return '';
  const ms = Date.now() - ts;
  if (ms < 0) return '';
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export function formatLatency(ms: number | null): string {
  if (ms === null || ms === undefined) return '';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function channelShortName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('telegram')) return 'TG';
  if (lower.includes('slack')) return 'Slack';
  if (lower.includes('discord')) return 'Discord';
  if (lower.includes('signal')) return 'Signal';
  if (lower.includes('whatsapp')) return 'WA';
  if (lower.includes('webchat')) return 'Web';
  return name.slice(0, 6);
}
