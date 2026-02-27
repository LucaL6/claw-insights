import type { SnapshotData } from '../../services/snapshot-types.js';
import { getAppVersion } from '../../version.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

export function renderFooter(data: SnapshotData, c: ColorScheme): SatoriNode {
  const datetime = data.timestamp.slice(0, 16).replace('T', ' ') + ' UTC';

  return div(
    {
      justifyContent: 'space-between',
      padding: '8px 20px 12px',
      borderTop: `1px solid ${c.border}`,
    },
    [
      span({ color: c.textDim, fontSize: 11 }, `Claw Insights v${getAppVersion()}`),
      span({ color: c.textDim, fontSize: 11, fontFamily: 'JetBrains Mono' }, datetime),
    ],
  );
}
