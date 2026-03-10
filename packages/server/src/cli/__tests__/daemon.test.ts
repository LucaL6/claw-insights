import { describe, expect, it } from 'vitest';

describe('daemon helpers', () => {
  it('getDataDir returns ~/.claw-insights', async () => {
    const { getDataDir } = await import('../daemon.js');
    const dir = getDataDir();
    expect(dir).toMatch(/\.claw-insights$/);
  });

  it('getDaemonPaths returns correct paths', async () => {
    const { getDaemonPaths } = await import('../daemon.js');
    const paths = getDaemonPaths();
    expect(paths.pidFile).toMatch(/claw-insights\.pid$/);
    expect(paths.logDir).toMatch(/logs$/);
    expect('logFile' in paths).toBe(false);
    expect(paths.daemonJson).toMatch(/daemon\.json$/);
  });

  it('reports current auth model text for protected mode', async () => {
    const { formatAuthModeLine } = await import('../daemon.js');
    expect(formatAuthModeLine(false)).toBe('Stable Bearer token + rotating session cookie');
  });

  it('reports token-file recovery hint without implying token regeneration', async () => {
    const { formatMissingTokenUrlHint } = await import('../daemon.js');
    expect(formatMissingTokenUrlHint(41041)).toContain('token URL file missing');
    expect(formatMissingTokenUrlHint(41041)).toContain('restart');
    expect(formatMissingTokenUrlHint(41041)).not.toContain('regenerate');
  });
});
