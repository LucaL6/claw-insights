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

  it('throws when no builtin dir and no custom dir (line 38)', () => {
    mockExistsSync.mockReturnValue(false);
    expect(() => loadFonts()).toThrow('Font directory not found');
  });

  it('throws when customDir set but invalid and no builtinDir (line 42)', () => {
    vi.stubEnv('CLAW_INSIGHTS_FONTS_DIR', '/tmp/nonexistent-xyz');
    mockExistsSync.mockReturnValue(false);
    expect(() => loadFonts()).toThrow('No valid font directory found');
  });
});
