/** Noise patterns — these go to the ticker, not the main log */
const NOISE_PATTERNS = [
  /^\d{4}\.\d+\.\d+$/, // version numbers like "2026.2.12"
  /^Usage cost/i, // usage cost header
  /^Total:\s*\$/i, // cost total line
  /^Missing entries:/i, // cost missing entries
  /^Latest day:/i, // cost latest day
  /^\{[\s\n]/, // raw JSON dumps (status --json output)
  /^{\s*"(heartbeat|service|ok|sessions|subsystem)"/i, // structured JSON status/debug
];

export interface LogEntry {
  time: string;
  level: string;
  module: string;
  message: string;
}

/** Classify a log entry as noise or signal */
export function isNoise(entry: LogEntry): boolean {
  if (entry.level === 'ERROR' || entry.level === 'WARN') return false; // never noise
  return NOISE_PATTERNS.some(p => p.test(entry.message));
}

/** Generate a dedup key for a log entry */
export function dedupKey(entry: LogEntry): string {
  return `${entry.time}|${entry.level}|${entry.message.slice(0, 80)}`;
}

/** Format noise entries for ticker display */
export function formatTickerText(entry: LogEntry): string {
  const msg = entry.message.trim();
  // Shorten common noise patterns
  if (/^\d{4}\.\d+\.\d+$/.test(msg)) return `v${msg}`;
  if (msg.startsWith('Total:')) return msg;
  if (msg.startsWith('Latest day:')) return msg;
  if (msg.startsWith('Usage cost')) return 'Usage cost check';
  if (msg.startsWith('Missing entries:')) return msg;
  if (msg.startsWith('{')) return `[status dump]`;
  return msg.slice(0, 60);
}
