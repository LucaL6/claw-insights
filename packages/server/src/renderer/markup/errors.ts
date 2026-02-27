import type { SnapshotData } from '../../services/snapshot-types.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

function errorBadge(type: string, c: ColorScheme): SatoriNode {
  const isError = type === 'error';
  return span(
    {
      padding: '1px 5px',
      borderRadius: 3,
      fontSize: 9,
      fontWeight: 600,
      backgroundColor: isError ? c.redBg : 'rgba(234,179,8,0.15)',
      color: isError ? c.red : c.amber,
    },
    type.toUpperCase(),
  );
}

export function renderErrors(data: SnapshotData, c: ColorScheme): SatoriNode | null {
  const errors = data.recentErrors;
  if (!errors || errors.length === 0) {
    return null;
  }

  const displayed = errors.slice(0, 5);

  return div({ flexDirection: 'column', gap: 4, padding: '0 16px 12px' }, [
    span(
      { color: c.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em', marginBottom: 2 },
      'RECENT EVENTS',
    ),
    ...displayed.map((e) => {
      const t = e.timestamp
        ? new Date(e.timestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
        : '';
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
          span({ color: c.textDim, fontSize: 11, fontFamily: 'JetBrains Mono' }, t),
          errorBadge(e.type || 'error', c),
          span({ color: c.textSecondary, fontSize: 12 }, e.message),
        ],
      );
    }),
  ]);
}
