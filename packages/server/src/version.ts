import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _appVersion: string | null = null;

export function getAppVersion(): string {
  if (_appVersion) {
    return _appVersion;
  }
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));
    _appVersion = pkg.version ?? '0.0.0';
  } catch {
    _appVersion = '0.0.0';
  }
  return _appVersion as string; // guaranteed non-null: set in both try and catch above
}
