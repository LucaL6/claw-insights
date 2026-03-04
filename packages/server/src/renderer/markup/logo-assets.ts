import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type BrandTheme = 'dark' | 'light';

export function resolveLogoAssetPath(
  file: string,
  moduleDir: string = dirname(fileURLToPath(import.meta.url)),
  pathExists: (path: string) => boolean = existsSync,
): string {
  const candidates = [
    resolve(moduleDir, '../../../../../../assets/logo', file),
    resolve(moduleDir, '../../../assets/logo', file),
    resolve(moduleDir, '../../../../../assets/logo', file),
    resolve(moduleDir, '../../../../web/public/logo', file),
    resolve(process.cwd(), 'assets/logo', file),
    resolve(process.cwd(), 'packages/web/public/logo', file),
  ];

  for (const candidate of candidates) {
    if (pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`${file} not found. Checked: ${candidates.join(', ')}`);
}

export function loadLogoDataUri(file: string): string {
  const logoPath = resolveLogoAssetPath(file);
  const svg = readFileSync(logoPath, 'utf8');
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export function getFooterBrandLogoFile(theme: BrandTheme): string {
  return theme === 'dark' ? 'icon-dark.svg' : 'icon-light.svg';
}
