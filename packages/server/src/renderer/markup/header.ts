import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createChildLogger } from '../../logger.js';
import type { Detail, SnapshotData } from '../../services/snapshot-types.js';
import { formatRange, t } from '../i18n/index.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

const log = createChildLogger('snapshot-header');

const FALLBACK_LOBSTER_SVG = `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" id="fallback-lobster">
  <rect width="120" height="120" rx="24" fill="#991b1b"/>
  <text x="60" y="72" text-anchor="middle" font-size="48" fill="white" font-weight="bold">OC</text>
</svg>`;

function svgToDataUri(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

export function resolveLobsterAssetPath(
  moduleDir: string = dirname(fileURLToPath(import.meta.url)),
  pathExists: (path: string) => boolean = existsSync,
): string | null {
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

  return null;
}

let cachedLobsterDataUri: string | null = null;

interface LobsterDataUriOptions {
  warn?: (msg: string) => void;
  moduleDir?: string;
  pathExists?: (path: string) => boolean;
  readText?: (path: string) => string;
}

export function getLobsterDataUri(opts: LobsterDataUriOptions = {}): string {
  const hasCustomIo = opts.moduleDir != null || opts.pathExists != null || opts.readText != null;

  if (!hasCustomIo && cachedLobsterDataUri) {
    return cachedLobsterDataUri;
  }

  const warn = opts.warn ?? ((msg: string) => log.warn(msg));
  const readText = opts.readText ?? ((path: string) => readFileSync(path, 'utf8'));
  const assetPath = resolveLobsterAssetPath(opts.moduleDir, opts.pathExists ?? existsSync);

  if (!assetPath) {
    warn('openclaw-lobster.svg missing, using fallback');
    const fallbackUri = svgToDataUri(FALLBACK_LOBSTER_SVG);
    if (!hasCustomIo) {
      cachedLobsterDataUri = fallbackUri;
    }
    return fallbackUri;
  }

  try {
    const svg = readText(assetPath);
    const uri = svgToDataUri(svg);
    if (!hasCustomIo) {
      cachedLobsterDataUri = uri;
    }
    return uri;
  } catch (err) {
    warn(`Failed to read ${assetPath}: ${err instanceof Error ? err.message : String(err)}`);
    const fallbackUri = svgToDataUri(FALLBACK_LOBSTER_SVG);
    if (!hasCustomIo) {
      cachedLobsterDataUri = fallbackUri;
    }
    return fallbackUri;
  }
}

/** @internal — exposed for testing only */
export function _resetLobsterCache(): void {
  cachedLobsterDataUri = null;
}

export function renderHeader(data: SnapshotData, _detail: Detail, c: ColorScheme, locale: string = 'en'): SatoriNode {
  const lobsterDataUri = getLobsterDataUri();

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
      src: lobsterDataUri,
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
