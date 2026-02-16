import { useState } from 'react';
import { SessionCard } from './SessionCard';
import { SubAgentCard } from './SubAgentCard';
import { groupByPrefix } from '../../utils/groupByPrefix';

interface SessionData {
  key: string;
  displayName: string;
  kind: string;
  model: string;
  channel: string | null;
  totalTokens: number;
  contextTokens: number;
  usagePercent: number;
  status: string;
  updatedAt: number;
  subAgents: SessionData[];
}

function SubAgentGroup({ prefix, items, totalTokens }: { prefix: string; items: SessionData[]; totalTokens: number }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full pl-4 py-1 text-left rounded transition-colors"
        style={{ color: 'var(--text-muted)' }}
      >
        <span className={`text-[10px] transition-transform ${expanded ? '' : '-rotate-90'}`}>▼</span>
        <span className="text-[12px] font-medium">{prefix} tasks</span>
        <span className="text-[11px]" style={{ color: 'var(--text-dim)' }}>({items.length})</span>
        <span className="text-[11px] mono ml-auto" style={{ color: 'var(--text-muted)' }}>{(totalTokens / 1000).toFixed(1)}k total</span>
      </button>
      {expanded && (
        <div className="pl-3 mt-1 space-y-1">
          {items.map((sa, i) => (
            <SubAgentCard
              key={sa.key}
              displayName={sa.displayName}
              model={sa.model}
              channel={sa.channel}
              totalTokens={sa.totalTokens}
              usagePercent={sa.usagePercent}
              status={sa.status}
              updatedAt={sa.updatedAt}
              isLast={i === items.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SessionGroup({ session }: { session: SessionData }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = session.subAgents.length > 0;
  const grouped = hasChildren ? groupByPrefix<SessionData>(session.subAgents) : [];

  return (
    <div>
      <div onClick={() => hasChildren && setExpanded(!expanded)}>
        <SessionCard
          {...session}
          hasChildren={hasChildren}
          expanded={expanded}
          onToggle={() => setExpanded(!expanded)}
          subAgentCount={hasChildren ? session.subAgents.length : undefined}
        />
      </div>
      {hasChildren && expanded && (
        <div className="pl-3 mt-1 space-y-1">
          {grouped.map((g, i) => {
            if (g.type === 'group') {
              return <SubAgentGroup key={g.prefix} prefix={g.prefix} items={g.items} totalTokens={g.totalTokens} />;
            }
            const sa = g.item;
            return (
              <SubAgentCard
                key={sa.key}
                displayName={sa.displayName}
                model={sa.model}
                channel={sa.channel}
                totalTokens={sa.totalTokens}
                usagePercent={sa.usagePercent}
                status={sa.status}
                updatedAt={sa.updatedAt}
                isLast={i === grouped.length - 1}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
