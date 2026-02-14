import { useState } from 'react';
import { SessionCard } from './SessionCard';
import { SubAgentCard } from './SubAgentCard';

interface SubAgent {
  key: string;
  label: string;
  status: string;
  totalTokens: number;
  updatedAt: number;
}

interface Session {
  key: string;
  displayName: string;
  kind: string;
  model: string;
  channel: string | null;
  totalTokens: number;
  usagePercent: number;
  status: string;
  subAgents: SubAgent[];
}

export function SessionGroup({ session }: { session: Session }) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = session.subAgents.length > 0;

  return (
    <div>
      <div className={hasChildren ? 'cursor-pointer' : ''} onClick={() => hasChildren && setExpanded(!expanded)}>
        <SessionCard {...session} />
      </div>
      {hasChildren && expanded && (
        <div className="ml-4 mt-1 space-y-1">
          {session.subAgents.map((sa, i) => (
            <SubAgentCard
              key={sa.key}
              label={sa.label}
              status={sa.status}
              totalTokens={sa.totalTokens}
              isLast={i === session.subAgents.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
