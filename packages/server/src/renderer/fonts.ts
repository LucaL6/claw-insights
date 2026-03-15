import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createChildLogger } from '../logger.js';
import { resolveAssetDir } from './asset-resolver.js';

const log = createChildLogger('fonts');

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

  const fontDir = resolveAssetDir('fonts');

  log.info({ fontDir, count: FONT_FILES.length }, 'loading fonts');
  fontCache = FONT_FILES.map(({ file, name, weight }) => ({
    name,
    data: readFileSync(resolve(fontDir, file)),
    weight,
    style: 'normal',
  }));

  return fontCache;
}
