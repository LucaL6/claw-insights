import { div, span } from './helpers.js';
import type { SatoriNode } from './helpers.js';
import type { ColorScheme } from './colors.js';
import type { SnapshotData } from '../../services/snapshot-types.js';
import { getAppVersion } from '../../version.js';

export function renderFooter(data: SnapshotData, c: ColorScheme): SatoriNode {
  return div(
    {
      justifyContent: 'space-between',
      padding: '8px 20px 12px',
      borderTop: `1px solid ${c.border}`,
    },
    [
      span({ color: c.textDim, fontSize: 10 }, `Uptime: ${data.gateway.uptime}`),
      span({ color: c.textDim, fontSize: 10 }, `Claw Insights v${getAppVersion()}`),
    ],
  );
}
