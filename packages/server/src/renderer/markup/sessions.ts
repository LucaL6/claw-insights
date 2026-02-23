import { div, span, Tag } from './helpers.js';
import type { SatoriNode } from './helpers.js';
import type { ColorScheme } from './colors.js';
import type { SnapshotData, SnapshotSession, Detail } from '../../services/snapshot-types.js';

function renderSessionCard(sess: SnapshotSession, c: ColorScheme): SatoriNode {
  const active = sess.status === 'active';
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
      backgroundColor: c.cardBg,
      border: `1px solid ${active ? 'rgba(16,185,129,0.2)' : c.border}`,
      borderRadius: 10, padding: '10px 12px', gap: 6,
    },
    [
      // Row 1: name + lastActive
      div({ alignItems: 'center', justifyContent: 'space-between' }, [
        div({ alignItems: 'center', gap: 8 }, [
          div({
            width: 7, height: 7, borderRadius: '50%',
            backgroundColor: active ? c.emerald : c.textDim,
          }),
          span({
            color: c.textPrimary, fontSize: 13, fontWeight: 500,
            fontFamily: 'JetBrains Mono',
          }, sess.name),
        ]),
        span({ color: c.textDim, fontSize: 10 }, sess.updatedAt),
      ]),
      // Row 2: tags + token bar
      div({ alignItems: 'center', justifyContent: 'space-between' }, [
        div({ alignItems: 'center', gap: 4 }, tags),
        div({ alignItems: 'center', gap: 6 }, [
          span({ color: c.textMuted, fontSize: 11, fontFamily: 'JetBrains Mono' }, sess.totalTokensDisplay),
          div({ width: 44, height: 5, borderRadius: 3, backgroundColor: c.trackBg, overflow: 'hidden' }, [
            div({ height: '100%', width: `${pct}%`, borderRadius: 3, backgroundColor: 'rgba(56,189,248,0.7)' }),
          ]),
          span({ color: c.textDim, fontSize: 9 }, `${pct}%`),
        ]),
      ]),
    ],
  );
}

export function renderSessions(data: SnapshotData, detail: Detail, c: ColorScheme): SatoriNode | null {
  if (detail === 'compact') return null;

  const sessions = data.sessions;
  if (!sessions || sessions.length === 0) return null;

  return div(
    { flexDirection: 'column', gap: 6, padding: '0 16px 12px' },
    [
      div({ justifyContent: 'space-between', marginBottom: 2 }, [
        span({ color: c.textMuted, fontSize: 11, fontWeight: 600 }, 'SESSIONS'),
        span({ color: c.textDim, fontSize: 11 }, `${data.summary.activeSessions} active · ${data.summary.totalSessions} total`),
      ]),
      ...sessions.map(s => renderSessionCard(s, c)),
    ],
  );
}
