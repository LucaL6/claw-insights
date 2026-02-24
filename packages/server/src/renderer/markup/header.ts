import type { Detail,SnapshotData } from '../../services/snapshot-types.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span, StatusBadge } from './helpers.js';

export function renderHeader(data: SnapshotData, detail: Detail, c: ColorScheme): SatoriNode {
  const gw = data.gateway;
  const isUp = gw.status === 'up';

  const leftItems: SatoriNode[] = [
    span({ fontSize: 15 }, '💡'),
    span({ color: c.textPrimary, fontWeight: 600, fontSize: 15 }, 'Claw Insights'),
    StatusBadge(isUp, c),
  ];

  if (detail !== 'compact') {
    const ver = gw.version.startsWith('v') ? gw.version : `v${gw.version}`;
    leftItems.push(span({ color: c.textDim, fontSize: 11 }, ver));
  }

  const rightItems: SatoriNode[] = [];

  if (detail !== 'compact') {
    rightItems.push(
      span({ color: c.textMuted, fontSize: 11 }, `CPU ${gw.cpu}%`),
      span({ color: c.textMuted, fontSize: 11 }, `MEM ${gw.memoryMB}MB`),
    );
  }

  rightItems.push(
    span({
      padding: '2px 6px',
      borderRadius: 4,
      backgroundColor: c.trackBg,
      color: c.textSecondary,
      fontSize: 10,
      fontWeight: 500,
    }, data.range),
    span({ color: c.textMuted, fontSize: 11, fontWeight: 500 }, data.time),
  );

  return div(
    {
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 20px',
      borderBottom: `1px solid ${c.border}`,
    },
    [
      div({ alignItems: 'center', gap: 10 }, leftItems),
      div({ alignItems: 'center', gap: 8 }, rightItems),
    ],
  );
}
