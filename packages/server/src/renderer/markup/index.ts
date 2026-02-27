import type { Detail, SnapshotData } from '../../services/snapshot-types.js';
import { getColors } from './colors.js';
import { renderErrors } from './errors.js';
import { renderFooter } from './footer.js';
import { renderHeader } from './header.js';
import type { SatoriNode } from './helpers.js';
import { div } from './helpers.js';
import { renderSessions } from './sessions.js';
import { renderStatusStrip } from './status-strip.js';
import { renderTokenUsage } from './token-usage.js';

export const VIEWPORT_WIDTH: Record<Detail, number> = { compact: 390, standard: 390, full: 390 };

export interface MarkupOptions {
  detail: Detail;
  theme: 'dark' | 'light';
  lang: 'en' | 'zh';
}

export function buildMarkup(data: SnapshotData, opts: MarkupOptions): SatoriNode {
  const c = getColors(opts.theme);
  const sections: (SatoriNode | null)[] = [
    renderHeader(data, opts.detail, c),
    renderStatusStrip(data, opts.detail, c),
    renderTokenUsage(data, opts.detail, c),
  ];
  if (opts.detail === 'standard' || opts.detail === 'full') {
    sections.push(renderSessions(data, opts.detail, c));
  }
  if ((opts.detail === 'standard' || opts.detail === 'full') && data.summary.errors > 0) {
    sections.push(renderErrors(data, c));
  }
  sections.push(renderFooter(data, c));

  // Ambient glow blobs (indigo top-left, emerald bottom-right) — soft circles
  const blobs =
    opts.theme === 'dark'
      ? [
          div({
            position: 'absolute',
            top: -80,
            left: -80,
            width: 260,
            height: 260,
            borderRadius: '50%',
            backgroundColor: 'rgba(99,102,241,0.06)',
          }),
          div({
            position: 'absolute',
            bottom: -60,
            right: -60,
            width: 220,
            height: 220,
            borderRadius: '50%',
            backgroundColor: 'rgba(52,211,153,0.04)',
          }),
        ]
      : [];

  return div(
    {
      flexDirection: 'column',
      width: VIEWPORT_WIDTH[opts.detail],
      backgroundColor: c.bg,
      fontFamily: 'Inter',
      position: 'relative',
      overflow: 'hidden',
    },
    [...blobs, ...sections.filter(Boolean)],
  );
}
