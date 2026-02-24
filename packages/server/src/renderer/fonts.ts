import { existsSync,readFileSync } from 'node:fs';
import { dirname,resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

interface SatoriFont {
  name: string;
  data: Buffer;
  weight: number;
  style: string;
}

const FONT_FILES = [
  { file: 'IBMPlexSans-Regular.ttf', name: 'IBM Plex Sans', weight: 400 },
  { file: 'IBMPlexSans-SemiBold.ttf', name: 'IBM Plex Sans', weight: 600 },
  { file: 'IBMPlexSans-Bold.ttf', name: 'IBM Plex Sans', weight: 700 },
  { file: 'JetBrainsMono-Regular.ttf', name: 'JetBrains Mono', weight: 400 },
];

let fontCache: SatoriFont[] | null = null;

export function resetFontCache(): void {
  fontCache = null;
}

export function loadFonts(): SatoriFont[] {
  if (fontCache) {return fontCache;}

  const customDir = process.env.CLAW_INSIGHTS_FONTS_DIR;
  const candidates = [
    resolve(__dirname, '../../assets/fonts'),
    resolve(__dirname, '../assets/fonts'),
  ];
  const builtinDir = candidates.find(d => existsSync(d));
  if (!builtinDir && !customDir) {
    throw new Error('Font directory not found. Set CLAW_INSIGHTS_FONTS_DIR or check installation.');
  }
  const fontDir = customDir && existsSync(customDir) ? customDir : builtinDir!;

  fontCache = FONT_FILES.map(({ file, name, weight }) => ({
    name,
    data: readFileSync(resolve(fontDir, file)),
    weight,
    style: 'normal',
  }));

  return fontCache;
}
