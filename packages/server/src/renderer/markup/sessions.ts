import type { Detail, SnapshotData, SnapshotSession } from '../../services/snapshot-types.js';
import type { ColorScheme } from './colors.js';
import type { SatoriNode } from './helpers.js';
import { div, span, Tag } from './helpers.js';

function renderSessionCard(sess: SnapshotSession, c: ColorScheme): SatoriNode {
  const pct = sess.usagePercent != null ? Math.round(sess.usagePercent) : 0;

  const tags: SatoriNode[] = [
    Tag(sess.modelDisplay || sess.model, c.tagModel.bg, c.tagModel.color, c.tagModel.border),
    Tag(sess.channel, c.tagChannel.bg, c.tagChannel.color, c.tagChannel.border),
  ];
  if (sess.subAgentCount > 0) {
    tags.push(Tag(`${sess.subAgentCount} sub`, c.tagSub.bg, c.tagSub.color, c.tagSub.border));
  }

  return div(
    {
      flexDirection: 'column',
      backgroundColor: c.glassBg,
      border: `1px solid ${c.glassBorder}`,
      borderRadius: 12,
      padding: '12px 14px',
      gap: 6,
    },
    [
      // Row 1: name + time
      div({ alignItems: 'center', justifyContent: 'space-between' }, [
        div({ alignItems: 'center', gap: 8 }, [
          div({
            width: 7,
            height: 7,
            borderRadius: '50%',
            backgroundColor: sess.status === 'active' ? c.emerald : c.textDim,
          }),
          span(
            {
              color: c.textPrimary,
              fontSize: 14,
              fontWeight: 600,
              fontFamily: 'JetBrains Mono',
            },
            sess.name,
          ),
        ]),
        span({ color: c.textDim, fontSize: 11 }, sess.updatedAt),
      ]),
      // Row 2: tags + turn count + mini-bar + tokens
      div({ alignItems: 'center', justifyContent: 'space-between' }, [
        div({ alignItems: 'center', gap: 8 }, [div({ alignItems: 'center', gap: 4 }, tags)]),
        div({ alignItems: 'center', gap: 6 }, [
          span(
            { color: c.textSecondary, fontSize: 12, fontFamily: 'JetBrains Mono', fontWeight: 500 },
            sess.totalTokensDisplay,
          ),
          div({ width: 44, height: 5, borderRadius: 3, backgroundColor: c.trackBg, overflow: 'hidden' }, [
            div({
              height: '100%',
              width: `${pct}%`,
              borderRadius: 3,
              backgroundImage: `linear-gradient(90deg, ${c.miniBarGradient[0]}, ${c.miniBarGradient[1]})`,
            }),
          ]),
        ]),
      ]),
    ],
  );
}

export function renderSessions(data: SnapshotData, detail: Detail, c: ColorScheme): SatoriNode | null {
  if (detail === 'compact') {
    return null;
  }

  const sessions = data.sessions;
  if (!sessions || sessions.length === 0) {
    return null;
  }

  const activeCount = sessions.filter((s) => s.status === 'active').length;

  return div({ flexDirection: 'column', gap: 6, padding: '0 16px 12px' }, [
    div({ justifyContent: 'space-between', marginBottom: 2 }, [
      span({ color: c.textMuted, fontSize: 10, fontWeight: 700, letterSpacing: '0.05em' }, 'SESSIONS'),
      span({ color: c.textDim, fontSize: 11 }, `${activeCount} active · ${sessions.length} total`),
    ]),
    ...sessions.map((s) => renderSessionCard(s, c)),
  ]);
}
