import type { Detail, SnapshotData } from '../../services/snapshot-types.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

export function renderHeader(data: SnapshotData, detail: Detail, c: ColorScheme): SatoriNode {
  const leftItems: SatoriNode[] = [
    span({ fontSize: 15 }, '💡'),
    span({ color: c.textPrimary, fontWeight: 600, fontSize: 15 }, 'Claw Insights'),
  ];

  if (detail !== 'compact') {
    const ver = data.gateway.version.startsWith('v') ? data.gateway.version : `v${data.gateway.version}`;
    leftItems.push(span({ color: c.textDim, fontSize: 11 }, ver));
  }

  return div(
    {
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 20px',
      borderBottom: `1px solid ${c.border}`,
    },
    [
      div({ alignItems: 'center', gap: 10 }, leftItems),
      div({ alignItems: 'center', gap: 8 }, [span({ color: c.textMuted, fontSize: 11, fontWeight: 500 }, data.time)]),
    ],
  );
}
