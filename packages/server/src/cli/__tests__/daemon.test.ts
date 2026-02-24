import { describe, expect,it } from 'vitest';

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
    expect(paths.logFile).toMatch(/server\.log$/);
    expect(paths.daemonJson).toMatch(/daemon\.json$/);
  });
});
