import { div, span } from './helpers.js';
import type { SatoriNode } from './helpers.js';
import type { ColorScheme } from './colors.js';
import type { SnapshotData, Detail } from '../../services/snapshot-types.js';

interface MetricDef {
  label: string;
  rangeLabel: string;
  getValue: (d: SnapshotData) => string;
  getValueColor: (d: SnapshotData, c: ColorScheme) => string;
}

function defs(_c: ColorScheme, range: string): MetricDef[] {
  return [
    {
      label: 'Active Sessions',
      rangeLabel: `peak ${range}`,
      getValue: (d) => String(d.summary.activeSessions),
      getValueColor: (_d, cc) => cc.textPrimary,
    },
    {
      label: 'Tokens',
      rangeLabel: `${range} total`,
      getValue: (d) => d.summary.tokensDisplay,
      getValueColor: (_d, cc) => cc.emerald,
    },
    {
      label: 'Errors',
      rangeLabel: `${range} total`,
      getValue: (d) => String(d.summary.errors),
      getValueColor: (d, cc) => (d.summary.errors > 0 ? cc.red : cc.textPrimary),
    },
    {
      label: 'Uptime',
      rangeLabel: `${range}`,
      getValue: (d) => d.summary.uptimePercent.toFixed(1) + '%',
      getValueColor: (_d, cc) => cc.emerald,
    },
  ];
}

export function renderMetrics(data: SnapshotData, detail: Detail, c: ColorScheme): SatoriNode {
  const items = defs(c, data.range);

  if (detail === 'compact') {
    return div(
      { flexWrap: 'wrap', gap: 12, padding: 16 },
      items.map((m) =>
        div(
          {
            width: '47%',
            flexDirection: 'column',
            backgroundColor: c.cardBg,
            border: `1px solid ${c.border}`,
            borderRadius: 12,
            padding: 16,
          },
          [
            div({ justifyContent: 'space-between', marginBottom: 6 }, [
              span({ color: c.textMuted, fontSize: 11, fontWeight: 500 }, m.label),
              span({ color: c.textDim, fontSize: 10 }, m.rangeLabel),
            ]),
            span({ color: m.getValueColor(data, c), fontSize: 28, fontWeight: 700 }, m.getValue(data)),
          ],
        ),
      ),
    );
  }

  // standard / full: horizontal 4-card row
  return div(
    { gap: 10, padding: '16px 16px 12px' },
    items.map((m) =>
      div(
        {
          flex: 1,
          flexDirection: 'column',
          alignItems: 'center',
          backgroundColor: c.cardBg,
          border: `1px solid ${c.border}`,
          borderRadius: 8,
          padding: '10px 12px',
        },
        [
          div({ alignItems: 'center', gap: 6 }, [
            span({ color: c.textMuted, fontSize: 10, fontWeight: 500 }, m.label),
            span({ color: c.textDim, fontSize: 9 }, m.rangeLabel),
          ]),
          span({ color: m.getValueColor(data, c), fontSize: 20, fontWeight: 700 }, m.getValue(data)),
        ],
      ),
    ),
  );
}
