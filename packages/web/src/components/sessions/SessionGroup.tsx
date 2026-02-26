import { useState } from 'react';

import { formatTokensRaw } from '../../utils/format';
import { groupByPrefix } from '../../utils/groupByPrefix';
import { SessionCard } from './SessionCard';
import { TreeConnector } from './shared/TreeConnector';
import type { SessionData } from './shared/types';

function SubAgentGroup({ prefix, items, totalTokens }: { prefix: string; items: SessionData[]; totalTokens: number }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div>
      <button
        onClick={() => {
          setExpanded(!expanded);
        }}
        className="flex items-center gap-2 w-full pl-4 py-1 text-left rounded transition-colors text-fg-muted"
      >
        <span className={`text-[10px] transition-transform ${expanded ? '' : '-rotate-90'}`}>▼</span>
        <span className="text-[12px] font-medium">{prefix} tasks</span>
        <span className="text-[11px] text-fg-dim">({items.length})</span>
        <span className="text-[11px] mono ml-auto text-fg-muted">{formatTokensRaw(totalTokens)} total</span>
      </button>
      {expanded && (
        <div className="pl-3 mt-1 space-y-1">
          {items.map((sa, i) => (
            <TreeConnector key={sa.key} isLast={i === items.length - 1}>
              <SessionCard
                variant="compact"
                displayName={sa.displayName}
                model={sa.model}
                channel={sa.channel ?? null}
                totalTokens={sa.totalTokens}
                usagePercent={sa.usagePercent}
                status={sa.status}
                updatedAt={sa.updatedAt}
              />
            </TreeConnector>
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
      <div
        onClick={() => {
          if (hasChildren) {
            setExpanded(!expanded);
          }
        }}
      >
        <SessionCard
          displayName={session.displayName}
          kind={session.kind}
          model={session.model}
          channel={session.channel ?? null}
          totalTokens={session.totalTokens}
          usagePercent={session.usagePercent}
          status={session.status}
          updatedAt={session.updatedAt}
          hasChildren={hasChildren}
          expanded={expanded}
          onToggle={() => {
            setExpanded(!expanded);
          }}
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
              <TreeConnector key={sa.key} isLast={i === grouped.length - 1}>
                <SessionCard
                  variant="compact"
                  displayName={sa.displayName}
                  model={sa.model}
                  channel={sa.channel ?? null}
                  totalTokens={sa.totalTokens}
                  usagePercent={sa.usagePercent}
                  status={sa.status}
                  updatedAt={sa.updatedAt}
                />
              </TreeConnector>
            );
          })}
        </div>
      )}
    </div>
  );
}
