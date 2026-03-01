import type { SnapshotData } from '../../services/snapshot-types.js';
import { t as i18n } from '../i18n/index.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

function errorBadge(type: string, c: ColorScheme, locale: string = 'en'): SatoriNode {
  const isError = type === 'error';
  return span(
    {
      padding: '2px 6px',
      borderRadius: 3,
      fontSize: 10,
      fontWeight: 700,
      flexShrink: 0,
      backgroundColor: isError ? 'rgba(239,68,68,0.12)' : 'rgba(234,179,8,0.12)',
      color: isError ? '#f87171' : c.amber,
    },
    type === 'error'
      ? i18n('errors.error', locale)
      : type === 'warning'
        ? i18n('errors.warning', locale)
        : type.toUpperCase(),
  );
}

export function renderErrors(data: SnapshotData, c: ColorScheme, locale: string = 'en'): SatoriNode | null {
  const errors = data.recentErrors;
  if (!errors || errors.length === 0) {
    return null;
  }

  const displayed = errors.slice(0, 5);

  return div({ flexDirection: 'column', gap: 4, padding: '0 16px 12px' }, [
    span(
      { color: c.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 2 },
      i18n('errors.title', locale),
    ),
    ...displayed.map((e) => {
      const t = e.timestamp
        ? new Date(e.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '';
      // Truncate long messages to ~120 chars
      const maxLen = 60;
      const msg = e.message.length > maxLen ? e.message.slice(0, maxLen) + '...' : e.message;

      return div(
        {
          alignItems: 'center',
          gap: 8,
          backgroundColor: c.glassBg,
          border: `1px solid ${c.glassBorder}`,
          borderRadius: 10,
          padding: '10px 12px',
        },
        [
          span({ color: c.textDim, fontSize: 11, fontFamily: 'JetBrains Mono', flexShrink: 0, lineHeight: 1 }, t),
          errorBadge(e.type || 'error', c, locale),
          span(
            { color: c.textSecondary, fontSize: 12, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis' },
            msg,
          ),
        ],
      );
    }),
  ]);
}
