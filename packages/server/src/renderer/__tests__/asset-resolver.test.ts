import { describe, expect, it, vi } from 'vitest';

import { resolveAssetDir } from '../asset-resolver.js';

describe('resolveAssetDir', () => {
  it('resolves fonts dir from npm package structure', () => {
    const result = resolveAssetDir('fonts', {
      moduleDir: '/pkg/server',
      cwd: '/pkg',
      pathExists: (p) => p === '/pkg/assets/fonts',
    });
    expect(result).toBe('/pkg/assets/fonts');
  });
  it('resolves fonts dir from monorepo dev structure', () => {
    const result = resolveAssetDir('fonts', {
      moduleDir: '/repo/packages/server/dist/renderer',
      cwd: '/repo',
      pathExists: (p) => p === '/repo/packages/server/assets/fonts',
    });
    expect(result).toBe('/repo/packages/server/assets/fonts');
  });
  it('prefers env override when set', () => {
    vi.stubEnv('CLAW_INSIGHTS_FONTS_DIR', '/custom/fonts');
    const result = resolveAssetDir('fonts', {
      moduleDir: '/pkg/server',
      cwd: '/pkg',
      pathExists: (p) => p === '/custom/fonts' || p === '/pkg/assets/fonts',
    });
    expect(result).toBe('/custom/fonts');
    vi.unstubAllEnvs();
  });
  it('throws with clear message when no candidate resolves', () => {
    expect(() =>
      resolveAssetDir('fonts', {
        moduleDir: '/nowhere',
        cwd: '/nowhere',
        pathExists: () => false,
      }),
    ).toThrow(/fonts.*not found/i);
  });
});
