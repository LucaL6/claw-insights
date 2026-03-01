export function formatUptime(startedAt: string | null | undefined): string {
  if (!startedAt) {
    return '';
  }
  const ts = new Date(startedAt).getTime();
  if (Number.isNaN(ts)) {
    return '';
  }
  const ms = Date.now() - ts;
  if (ms < 0) {
    return '';
  }
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
}

export function formatLatency(ms: number | null): string {
  if (ms === null) {
    return '';
  }
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

/**
 * Format token count (in K) to human-readable string with auto unit.
 * < 1k → "123" (raw), 1-999k → "42.1k", ≥ 1000k → "1.23M"
 */
export function formatTokensK(valueK: number): string {
  if (valueK < 1) {
    return valueK <= 0 ? '0' : (valueK * 1000).toFixed(0);
  }
  if (valueK >= 1000) {
    return `${(valueK / 1000).toFixed(2)}M`;
  }
  return `${valueK.toFixed(1)}k`;
}

/**
 * Format raw token count to human-readable string with auto unit.
 */
export function formatTokensRaw(value: number): string {
  return formatTokensK(value / 1000);
}

/**
 * Format memory in MB to human-readable string.
 * < 1024 MB → "512 MB", ≥ 1024 MB → "1.23 GB" (2 decimal places)
 */
export function formatMemoryMB(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toFixed(2)} GB`;
  }
  return `${Math.round(mb)} MB`;
}

export function channelShortName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes('telegram')) {
    return 'TG';
  }
  if (lower.includes('slack')) {
    return 'Slack';
  }
  if (lower.includes('discord')) {
    return 'Discord';
  }
  if (lower.includes('signal')) {
    return 'Signal';
  }
  if (lower.includes('whatsapp')) {
    return 'WA';
  }
  if (lower.includes('webchat')) {
    return 'Web';
  }
  return name.slice(0, 6);
}
