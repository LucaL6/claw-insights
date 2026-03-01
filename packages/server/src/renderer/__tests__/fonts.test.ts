import { afterEach, describe, expect, it, vi } from 'vitest';

import { loadFonts, resetFontCache } from '../fonts.js';

describe('loadFonts', () => {
  afterEach(() => resetFontCache());

  it('loads 7 built-in fonts', async () => {
    const fonts = await loadFonts();
    expect(fonts).toHaveLength(7);
    expect(fonts[0]).toMatchObject({ name: 'Inter', weight: 400, style: 'normal' });
    expect(fonts[5]).toMatchObject({ name: 'JetBrains Mono', weight: 400, style: 'normal' });
    expect(fonts[6]).toMatchObject({ name: 'Noto Sans SC', weight: 400, style: 'normal' });
    fonts.forEach((f) => expect(f.data).toBeInstanceOf(Buffer));
  });

  it('caches fonts on second call', async () => {
    const a = await loadFonts();
    const b = await loadFonts();
    expect(a).toBe(b);
  });

  it('uses custom font dir when CLAW_INSIGHTS_FONTS_DIR is set', async () => {
    const tmpDir = '/tmp/test-fonts-nonexistent';
    vi.stubEnv('CLAW_INSIGHTS_FONTS_DIR', tmpDir);
    const fonts = await loadFonts();
    expect(fonts).toHaveLength(7);
    vi.unstubAllEnvs();
  });

  it('throws when a custom font dir has missing files', async () => {
    const tmpDir = '/tmp/test-fonts-empty-' + Date.now();
    const { mkdirSync, rmSync } = await import('node:fs');
    mkdirSync(tmpDir, { recursive: true });
    vi.stubEnv('CLAW_INSIGHTS_FONTS_DIR', tmpDir);
    try {
      expect(() => loadFonts()).toThrow();
    } finally {
      vi.unstubAllEnvs();
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
