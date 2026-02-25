import type { Detail, SnapshotData } from '../../services/snapshot-types.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span, StatusBadge } from './helpers.js';

export function renderGatewayBanner(data: SnapshotData, detail: Detail, c: ColorScheme): SatoriNode | null {
  if (detail === 'compact') return null;

  const gw = data.gateway;
  const isDown = gw.status === 'down' || gw.status === 'connecting';

  // Sort channels: copy first, connected first then alpha by name
  const channels = [...(data.channels ?? [])].sort((a, b) => {
    if (a.connected !== b.connected) return a.connected ? -1 : 1;
    return (a.name ?? '').localeCompare(b.name ?? '');
  });

  // Channel overflow: max 3 visible, >3 → first 2 + "+N"
  const MAX_VISIBLE = 3;
  const OVERFLOW_SHOW = 2;
  let visibleChannels = channels;
  let overflowCount = 0;
  if (channels.length > MAX_VISIBLE) {
    visibleChannels = channels.slice(0, OVERFLOW_SHOW);
    overflowCount = channels.length - OVERFLOW_SHOW;
  }

  // Left group: "OpenClaw Gateway" + status pill
  const leftGroup = div({ alignItems: 'center', gap: 8 }, [
    span({ fontSize: 12, fontWeight: 600, color: c.textSecondary }, 'OpenClaw Gateway'),
    StatusBadge(!isDown, c),
  ]);

  // Center group: channel pills (skip if 0 channels)
  let centerGroup: SatoriNode | null = null;
  if (visibleChannels.length > 0) {
    const channelNodes: SatoriNode[] = [];
    visibleChannels.forEach((ch, i) => {
      if (i > 0) {
        channelNodes.push(span({ color: c.textDim, fontSize: 10 }, '·'));
      }
      const dotColor = ch.connected ? c.emerald : c.textDim;
      const textColor = isDown ? c.textDim : c.textSecondary;
      channelNodes.push(
        div({ alignItems: 'center', gap: 4 }, [
          div({ width: 6, height: 6, borderRadius: '50%', backgroundColor: isDown ? c.textDim : dotColor }),
          span({ fontSize: 11, fontWeight: 500, color: textColor }, ch.name),
        ]),
      );
    });
    if (overflowCount > 0) {
      channelNodes.push(span({ color: c.textDim, fontSize: 10 }, '·'));
      channelNodes.push(span({ color: c.textDim, fontSize: 10, fontWeight: 500 }, `+${overflowCount}`));
    }
    centerGroup = div({ alignItems: 'center', gap: 8 }, channelNodes);
  }

  // Right group: CPU + MEM
  const cpuText = Number.isFinite(gw.cpu) ? `CPU ${Math.round(gw.cpu)}%` : 'CPU --';
  const memText = Number.isFinite(gw.memoryMB) ? `MEM ${Math.round(gw.memoryMB)}M` : 'MEM --';
  const resourceColor = isDown ? c.textDim : c.textMuted;
  const rightGroup = div({ alignItems: 'center', gap: 12 }, [
    span({ fontSize: 11, color: resourceColor }, cpuText),
    span({ fontSize: 11, color: resourceColor }, memText),
  ]);

  // Banner container
  const bannerStyle: Record<string, unknown> = {
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 20px',
    borderBottom: `1px solid ${c.border}`,
  };

  if (isDown) {
    bannerStyle.backgroundColor = c.gatewayDownBg;
    bannerStyle.borderBottom = `1px solid ${c.gatewayDownBorder}`;
    bannerStyle.borderTop = `1px solid ${c.gatewayDownBorder}`;
  }

  const children: SatoriNode[] = [leftGroup];
  if (centerGroup) children.push(centerGroup);
  children.push(rightGroup);

  return div(bannerStyle, children);
}
