import { uptimeStatus } from '../../services/snapshot-formatters.js';
import type { Detail, SnapshotData } from '../../services/snapshot-types.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span, Sparkline, UptimeStrip } from './helpers.js';

export function renderCharts(data: SnapshotData, detail: Detail, c: ColorScheme): SatoriNode {
  const rawBuckets = data.buckets ?? [];
  const sp = {
    tokens: rawBuckets.map((b) => b.tokensK ?? b.tokens ?? 0),
    uptime: rawBuckets.map((b) => uptimeStatus(b.uptimePercent ?? 100)),
  };
  const height = detail === 'compact' ? 40 : 48;

  const rangeHours = parseInt(data.range) || 6;
  const now = new Date();
  const start = new Date(now.getTime() - rangeHours * 3600_000);
  const fmt = (d: Date) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  const startLabel = fmt(start);
  const endLabel = fmt(now);

  const timeAxis = () =>
    div({ justifyContent: 'space-between', marginTop: 4 }, [
      span({ color: c.textDim, fontSize: 8 }, startLabel),
      span({ color: c.textDim, fontSize: 8 }, endLabel),
    ]);

  return div({ gap: 10, padding: '0 16px 12px' }, [
    // Token Usage card
    div(
      {
        flex: 1,
        flexDirection: 'column',
        backgroundColor: c.cardBg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        padding: 12,
      },
      [
        span({ color: c.textMuted, fontSize: 10, fontWeight: 500, marginBottom: 8 }, 'Token Usage'),
        Sparkline(sp.tokens, c.emerald, height),
        timeAxis(),
      ],
    ),
    // Uptime card
    div(
      {
        flex: 1,
        flexDirection: 'column',
        backgroundColor: c.cardBg,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        padding: 12,
      },
      [
        span({ color: c.textMuted, fontSize: 10, fontWeight: 500, marginBottom: 8 }, 'Uptime'),
        UptimeStrip(sp.uptime, c.uptimeMap, height),
        timeAxis(),
      ],
    ),
  ]);
}
