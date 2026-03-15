import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

/**
 * Root data directory for claw-insights.
 *
 * Override with `CLAW_INSIGHTS_HOME` env var for testing or multi-instance setups.
 * Must be an absolute path; empty/whitespace-only/relative values are ignored.
 * Default: `~/.claw-insights`
 */
export function getDataDir(): string {
  const env = process.env.CLAW_INSIGHTS_HOME?.trim();
  if (env && isAbsolute(env)) {
    return env;
  }
  return join(homedir(), '.claw-insights');
}
