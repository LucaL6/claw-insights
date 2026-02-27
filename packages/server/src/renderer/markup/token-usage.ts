import type { Detail, SnapshotData } from '../../services/snapshot-types.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

export function renderTokenUsage(data: SnapshotData, _detail: Detail, c: ColorScheme): SatoriNode {
  const models = data.tokensByModel ?? [];
  const trend = data.tokensTrend;

  // Split tokensDisplay into number + unit (e.g. "12.3k" → "12.3" + "K")
  const display = data.summary.tokensDisplay;
  const match = display.match(/^([\d.,]+)\s*([a-zA-Z]*)$/);
  const numberPart = match ? match[1] : display;
  const unitPart = match && match[2] ? match[2].toUpperCase() : '';

  return div({ flexDirection: 'column', gap: 10, padding: '0 16px 12px' }, [
    // Top row: TOKENS label + range pill (left) | trend badge (right)
    div({ justifyContent: 'space-between', alignItems: 'center' }, [
      div({ alignItems: 'center', gap: 8 }, [
        span({ color: c.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }, 'TOKENS'),
        data.range
          ? span(
              {
                backgroundColor: c.rangePill.bg,
                color: c.rangePill.color,
                border: `1px solid ${c.rangePill.border}`,
                borderRadius: 6,
                padding: '2px 8px',
                fontSize: 10,
                fontWeight: 600,
              },
              data.range,
            )
          : null,
      ]),
      trend
        ? span(
            {
              backgroundColor: c.trendBadge.bg,
              color: c.trendBadge.color,
              border: `1px solid ${c.trendBadge.border}`,
              borderRadius: 8,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 600,
            },
            trend,
          )
        : null,
    ]),

    // Big number
    div({ alignItems: 'baseline', gap: 2 }, [
      span({ color: c.textPrimary, fontSize: 28, fontWeight: 800 }, numberPart),
      unitPart ? span({ color: c.textMuted, fontSize: 14, fontWeight: 600 }, unitPart) : null,
    ]),

    // Stacked bar
    div({ height: 8, borderRadius: 999, backgroundColor: c.trackBg, overflow: 'hidden' }, [
      div(
        { width: '100%', height: '100%', alignItems: 'stretch', gap: 2 },
        models.map((m, i) => {
          const gi = i % c.modelGradients.length;
          return div({
            height: '100%',
            width: `${Math.max(0, m.percent)}%`,
            borderRadius: 999,
            backgroundImage: `linear-gradient(90deg, ${c.modelGradients[gi][0]}, ${c.modelGradients[gi][1]})`,
          });
        }),
      ),
    ]),

    // Legend
    div(
      { flexWrap: 'wrap', gap: '8px 14px' },
      models.map((m, i) => {
        const gi = i % c.modelGradients.length;
        return div({ alignItems: 'center', gap: 6 }, [
          div({
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundImage: `linear-gradient(90deg, ${c.modelGradients[gi][0]}, ${c.modelGradients[gi][1]})`,
          }),
          span({ color: c.textSecondary, fontSize: 12 }, m.modelDisplay || m.model),
          span({ color: c.textDim, fontSize: 11, fontFamily: 'JetBrains Mono' }, `${m.tokensK}k`),
        ]);
      }),
    ),
  ]);
}
