import type { Detail, SnapshotData } from '../../services/snapshot-types.js';
import { formatRange, t } from '../i18n/index.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

// OpenClaw lobster icon — inlined as data URI to avoid path resolution issues in bundled dist
const LOBSTER_SVG = `<svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="lg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#ff4d4d"/><stop offset="100%" stop-color="#991b1b"/></linearGradient></defs><path d="M60 10C30 10 15 35 15 55C15 75 30 95 45 100L45 110 55 110 55 100C55 100 60 102 65 100L65 110 75 110 75 100C90 95 105 75 105 55C105 35 90 10 60 10Z" fill="url(#lg)"/><path d="M20 45C5 40 0 50 5 60C10 70 20 65 25 55C28 48 25 45 20 45Z" fill="url(#lg)"/><path d="M100 45C115 40 120 50 115 60C110 70 100 65 95 55C92 48 95 45 100 45Z" fill="url(#lg)"/><path d="M45 15Q35 5 30 8" stroke="#ff4d4d" stroke-width="3" stroke-linecap="round"/><path d="M75 15Q85 5 90 8" stroke="#ff4d4d" stroke-width="3" stroke-linecap="round"/><circle cx="45" cy="35" r="6" fill="#050810"/><circle cx="75" cy="35" r="6" fill="#050810"/><circle cx="46" cy="34" r="2.5" fill="#00e5cc"/><circle cx="76" cy="34" r="2.5" fill="#00e5cc"/></svg>`;
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
