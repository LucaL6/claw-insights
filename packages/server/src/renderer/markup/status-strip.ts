import type { Detail, SnapshotData } from '../../services/snapshot-types.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

export function renderStatusStrip(data: SnapshotData, detail: Detail, c: ColorScheme): SatoriNode | null {
  if (detail === 'compact') {
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

  const row1 = div({ alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }, [
    div({ alignItems: 'center', gap: 6, flexWrap: 'wrap' }, channelPills),
    div({ alignItems: 'baseline', gap: 4 }, [
      span(
        { fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono', color: c.accentIndigo },
        String(data.totalConversations),
      ),
      span({ fontSize: 11, color: c.textDim }, 'conversations'),
    ]),
  ]);

  // --- Divider ---
  const divider = div({ height: 1, backgroundColor: c.glassDivider, margin: '0 12px' });

  // --- Row 2: metrics (left) + CPU/MEM (right) ---
  function metric(value: string, label: string, color: string): SatoriNode {
    return div({ alignItems: 'baseline', gap: 3 }, [
      span({ fontSize: 14, fontWeight: 700, fontFamily: 'JetBrains Mono', color }, value),
      span({ fontSize: 11, color: c.textDim }, label),
    ]);
  }

  const cpuText = Number.isFinite(gw.cpu) ? `CPU ${Math.round(gw.cpu)}%` : 'CPU --';
  const memText = Number.isFinite(gw.memoryMB) ? `MEM ${Math.round(gw.memoryMB)}M` : 'MEM --';

  const row2 = div({ alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px' }, [
    div({ alignItems: 'center', gap: 14 }, [
      metric(String(s.activeSessions), 'sessions', c.accentIndigo),
      metric(`${s.uptimePercent}%`, 'uptime', c.emerald),
      metric(String(s.errors), 'errors', c.red),
    ]),
    span({ fontSize: 10, color: c.textDim }, `${cpuText}  ${memText}`),
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
