import { afterEach, describe, expect, it, vi } from 'vitest';

const { mockExistsSync } = vi.hoisted(() => {
  const mockExistsSync = vi.fn(() => false);
  return { mockExistsSync };
});

vi.mock('node:fs', async (importOriginal) => {
  const orig = await importOriginal<typeof import('node:fs')>();
  return { ...orig, existsSync: mockExistsSync };
});

import { loadFonts, resetFontCache } from '../fonts.js';

describe('loadFonts branch coverage', () => {
  afterEach(() => {
    resetFontCache();
    vi.unstubAllEnvs();
    mockExistsSync.mockReset().mockReturnValue(false);
  });

  it('throws when no font directory found', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => loadFonts()).toThrow(/fonts.*not found/i);
  });

  it('throws when customDir set but invalid and no builtinDir', () => {
    vi.stubEnv('CLAW_INSIGHTS_FONTS_DIR', '/tmp/nonexistent-xyz');
    mockExistsSync.mockReturnValue(false);
    expect(() => loadFonts()).toThrow(/fonts.*not found/i);
  });
});
