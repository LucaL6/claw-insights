import type { Detail, SnapshotData } from '../../services/snapshot-types.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span } from './helpers.js';

export function renderTokenUsage(data: SnapshotData, _detail: Detail, c: ColorScheme): SatoriNode {
  const models = data.tokensByModel ?? [];
  const trend = data.tokensTrend;

  return div({ flexDirection: 'column', gap: 10, padding: '0 16px 12px' }, [
    div({ justifyContent: 'space-between', alignItems: 'flex-start' }, [
      span({ color: c.textMuted, fontSize: 11, fontWeight: 600 }, 'TOKENS'),
      div({ flexDirection: 'column', alignItems: 'flex-end', gap: 2 }, [
        span({ color: c.textPrimary, fontSize: 16, fontWeight: 700 }, data.summary.tokensDisplay),
        trend ? span({ color: c.textSecondary, fontSize: 11 }, trend) : null,
      ]),
    ]),
    div({ height: 10, borderRadius: 999, backgroundColor: c.trackBg, overflow: 'hidden' }, [
      div(
        { width: '100%', height: '100%', alignItems: 'stretch', gap: 0 },
        models.map((m, i) =>
          div({
            height: '100%',
            width: `${Math.max(0, m.percent)}%`,
            backgroundColor: c.modelColors[i % c.modelColors.length],
          }),
        ),
      ),
    ]),
    div(
      { flexWrap: 'wrap', gap: 12 },
      models.map((m, i) =>
        div({ alignItems: 'center', gap: 6 }, [
          div({ width: 8, height: 8, borderRadius: '50%', backgroundColor: c.modelColors[i % c.modelColors.length] }),
          span({ color: c.textSecondary, fontSize: 11 }, `${m.modelDisplay || m.model} ${m.tokensK}k (${m.percent}%)`),
        ]),
      ),
    ),
  ]);
}
