import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { div, span } from './helpers.js';
import type { SatoriNode } from './helpers.js';
import type { ColorScheme } from './colors.js';
import type { SnapshotData } from '../../services/snapshot-types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

let _version: string | null = null;
export function getVersion(): string {
  if (_version) return _version;
  for (const rel of ['../package.json', '../../../../../package.json', '../../../../package.json', '../../../package.json', '../../package.json']) {
    try {
      const pkg = JSON.parse(readFileSync(resolve(__dirname, rel), 'utf8'));
      if (pkg.version) { _version = pkg.version; return _version; }
    } catch { /* skip */ }
  }
  _version = '0.0.0';
  return _version;
}

export function renderFooter(data: SnapshotData, c: ColorScheme): SatoriNode {
  return div(
    {
      justifyContent: 'space-between',
      padding: '8px 20px 12px',
      borderTop: `1px solid ${c.border}`,
    },
    [
      span({ color: c.textDim, fontSize: 10 }, `Uptime: ${data.gateway.uptime}`),
      span({ color: c.textDim, fontSize: 10 }, `Claw Insights v${getVersion()}`),
    ],
  );
}
