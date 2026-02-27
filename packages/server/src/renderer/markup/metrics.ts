import type { Detail, SnapshotData } from '../../services/snapshot-types.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

export function renderMetrics(data: SnapshotData, _detail: Detail, c: ColorScheme): SatoriNode {
  const items: SatoriNode[] = [
    span({ color: c.textPrimary, fontSize: 18, fontWeight: 600 }, `${data.summary.activeSessions} active sessions`),
  ];

  if (data.summary.errors > 0) {
    items.push(span({ color: c.red, fontSize: 18, fontWeight: 600 }, `⚠️ ${data.summary.errors} errors`));
  }

  items.push(
    span({ color: c.emerald, fontSize: 18, fontWeight: 700 }, `${data.summary.uptimePercent.toFixed(1)}% uptime`),
  );

  return div({ justifyContent: 'center', alignItems: 'center', gap: 24, padding: '14px 20px' }, items);
}
