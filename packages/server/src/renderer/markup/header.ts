import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Detail, SnapshotData } from '../../services/snapshot-types.js';
import { formatRange, t } from '../i18n/index.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

export function resolveLobsterAssetPath(
  moduleDir: string = dirname(fileURLToPath(import.meta.url)),
  pathExists: (path: string) => boolean = existsSync,
): string {
  const candidates = [
    resolve(moduleDir, '../../../assets/openclaw-lobster.svg'),
    resolve(moduleDir, '../assets/openclaw-lobster.svg'),
    resolve(process.cwd(), 'packages/server/assets/openclaw-lobster.svg'),
  ];

  for (const candidate of candidates) {
    if (pathExists(candidate)) {
      return candidate;
    }
  }

  throw new Error(`openclaw-lobster.svg not found. Checked: ${candidates.join(', ')}`);
}

const LOBSTER_ASSET_PATH = resolveLobsterAssetPath();
const LOBSTER_SVG = readFileSync(LOBSTER_ASSET_PATH, 'utf8');
const LOBSTER_DATA_URI = `data:image/svg+xml;base64,${Buffer.from(LOBSTER_SVG).toString('base64')}`;

export function renderHeader(data: SnapshotData, _detail: Detail, c: ColorScheme, locale: string = 'en'): SatoriNode {
  const isOnline = data.gateway?.status === 'up';
  const dotColor = data.gateway == null ? c.textDim : isOnline ? c.onlineDot : c.red;
  const statusLabel =
    data.gateway == null
      ? t('status.unknown', locale)
      : isOnline
        ? t('status.online', locale)
        : t('status.offline', locale);

  const subtitle = data.range ? t('header.subtitle', locale, { range: formatRange(data.range, locale) }) : '';

  const iconBox: SatoriNode = {
    type: 'img',
    props: {
      src: LOBSTER_DATA_URI,
      width: 32,
      height: 32,
      style: { display: 'flex', width: 32, height: 32, borderRadius: 8 },
    },
  };

  const textCol = div({ flexDirection: 'column', gap: 2 }, [
    span({ color: c.textPrimary, fontWeight: 700, fontSize: 16 }, 'OpenClaw'),
    subtitle ? span({ color: c.textMuted, fontSize: 11 }, subtitle) : null,
  ]);

  const statusDot = div({
    width: 8,
    height: 8,
    borderRadius: '50%',
    backgroundColor: dotColor,
  });

  const statusText = span({ color: dotColor, fontSize: 13, fontWeight: 600 }, statusLabel);

  return div(
    {
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 20px',
    },
    [
      div({ alignItems: 'center', gap: 10 }, [iconBox, textCol]),
      div({ alignItems: 'center', gap: 6 }, [statusDot, statusText]),
    ],
  );
}
