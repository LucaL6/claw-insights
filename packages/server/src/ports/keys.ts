// src/ports/keys.ts

/**
 * Port registry keys - single source of truth for port identifiers.
 * Use these constants instead of string literals.
 */
export const PORT_KEYS = Object.freeze({
  sessions: 'sessions',
  metrics: 'metrics',
  gateway: 'gateway',
  cron: 'cron',
  logs: 'logs',
  system: 'system',
  lifetime: 'lifetime',
  transcript: 'transcript',
  usage: 'usage',
} as const);

export type PortKey = (typeof PORT_KEYS)[keyof typeof PORT_KEYS];
