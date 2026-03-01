import type { Detail, SnapshotData } from '../../services/snapshot-types.js';
import { t } from '../i18n/index.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

export function renderStatusStrip(
  data: SnapshotData,
  detail: Detail,
  c: ColorScheme,
  locale: string = 'en',
): SatoriNode | null {
  if (detail === 'compact') {
    return null;
  }
  if (!data.summary && !data.channels) {
    return null;
  }

  const gw = data.gateway;
  const s = data.summary;

  // --- Row 1: channels (left) + conversations (right) ---
  const channels = [...(data.channels ?? [])].sort((a, b) => {
    if (a.connected !== b.connected) {
      return a.connected ? -1 : 1;
    }
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  const channelPills = channels.map((ch) =>
    span(
      {
        fontSize: 10,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 6,
        backgroundColor: c.glassBg,
        border: `1px solid ${c.glassBorder}`,
        color: ch.connected ? c.onlineDot : c.textDim,
      },
      ch.name,
    ),
  );

  const cpuText = gw && Number.isFinite(gw.cpu) ? `CPU ${Math.round(gw.cpu)}%` : 'CPU --';
  const memText =
    gw && Number.isFinite(gw.memoryMB)
      ? `MEM ${gw.memoryMB >= 1024 ? `${(gw.memoryMB / 1024).toFixed(2)} GB` : `${Math.round(gw.memoryMB)} MB`}`
      : 'MEM --';

  const row1 = div({ alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }, [
    div({ alignItems: 'center', gap: 6, flexWrap: 'wrap' }, channelPills),
    span({ fontSize: 10, color: c.textDim }, `${cpuText}  ${memText}`),
  ]);

  // --- Divider ---
  const divider = div({ height: 1, backgroundColor: c.glassDivider, margin: '0 12px' });

  // --- Row 2: metrics ---
  function metric(value: string, label: string, color: string): SatoriNode {
    return div({ alignItems: 'center', gap: 3 }, [
      span({ fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono', color, lineHeight: 1 }, value),
      span({ fontSize: 11, color: c.textDim, lineHeight: 1 }, label),
    ]);
  }

  const row2 = div({ alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }, [
    div({ alignItems: 'center', gap: 14, flexWrap: 'wrap' }, [
      metric(String(s?.activeSessions ?? 0), t('summary.sessions', locale), c.accentIndigo),
      metric(`${s?.uptimePercent ?? 0}%`, t('summary.uptime', locale), c.emerald),
      metric(String(s?.errors ?? 0), t('summary.errors', locale), c.red),
      metric(String(data.summary?.totalMessages ?? 0), t('summary.messages', locale), c.accentIndigo),
    ]),
  ]);

  return div(
    {
      flexDirection: 'column',
      backgroundColor: c.glassBg,
      border: `1px solid ${c.glassBorder}`,
      borderRadius: 12,
      margin: '0 16px 14px',
      padding: 0,
      overflow: 'hidden',
    },
    [row1, divider, row2],
  );
}
