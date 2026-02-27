import type { Detail, SnapshotData } from '../../services/snapshot-types.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

export function renderHeader(data: SnapshotData, detail: Detail, c: ColorScheme): SatoriNode {
  const isOnline = data.gateway.status === 'up';
  const dotColor = isOnline ? c.onlineDot : c.red;
  const statusLabel = isOnline ? 'Online' : 'Offline';

  const subtitle = `陪伴 ${data.companionDays} 天 · ${data.hostname}`;

  const iconBox = div(
    {
      width: 32,
      height: 32,
      borderRadius: 10,
      backgroundImage: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    [span({ fontSize: 16 }, '🐾')],
  );

  const textCol = div({ flexDirection: 'column', gap: 2 }, [
    span({ color: c.textPrimary, fontWeight: 700, fontSize: 16 }, 'OpenClaw'),
    span({ color: c.textMuted, fontSize: 11 }, subtitle),
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
