import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createChildLogger } from '../logger.js';

const log = createChildLogger('fonts');

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SatoriFont {
  name: string;
  data: Buffer;
  weight: number;
  style: string;
}

const FONT_FILES = [
  { file: 'Inter-Regular.ttf', name: 'Inter', weight: 400 },
  { file: 'Inter-Medium.ttf', name: 'Inter', weight: 500 },
  { file: 'Inter-SemiBold.ttf', name: 'Inter', weight: 600 },
  { file: 'Inter-Bold.ttf', name: 'Inter', weight: 700 },
  { file: 'Inter-ExtraBold.ttf', name: 'Inter', weight: 800 },
  { file: 'JetBrainsMono-Regular.ttf', name: 'JetBrains Mono', weight: 400 },
  // CJK fallback — SIL OFL subset containing only snapshot UI characters (~22KB)
  { file: 'NotoSansSC-Regular-subset.ttf', name: 'Noto Sans SC', weight: 400 },
];

let fontCache: SatoriFont[] | null = null;

export function resetFontCache(): void {
  fontCache = null;
}

export function loadFonts(): SatoriFont[] {
  if (fontCache) {
    return fontCache;
  }

  const customDir = process.env.CLAW_INSIGHTS_FONTS_DIR;
  const candidates = [resolve(__dirname, '../../assets/fonts'), resolve(__dirname, '../assets/fonts')];
  const builtinDir = candidates.find((d) => existsSync(d));
  if (!builtinDir && !customDir) {
    log.warn('font directory not found — set CLAW_INSIGHTS_FONTS_DIR or check installation');
    throw new Error('Font directory not found. Set CLAW_INSIGHTS_FONTS_DIR or check installation.');
  }
  const fontDir = customDir && existsSync(customDir) ? customDir : builtinDir;
  if (!fontDir) {
    log.warn('no valid font directory resolved');
    throw new Error('No valid font directory found');
  }

  log.info({ fontDir, count: FONT_FILES.length }, 'loading fonts');
  fontCache = FONT_FILES.map(({ file, name, weight }) => ({
    name,
    data: readFileSync(resolve(fontDir, file)),
    weight,
    style: 'normal',
  }));

  return fontCache;
}
