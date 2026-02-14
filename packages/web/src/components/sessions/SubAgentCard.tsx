interface Props {
  label: string;
  status: string;
  totalTokens: number;
  isLast: boolean;
}

const STATUS_BADGE: Record<string, { color: string; text: string }> = {
  ACTIVE: { color: 'text-emerald-400', text: 'RUNNING' },
  DONE: { color: 'text-blue-400', text: 'DONE' },
  FAILED: { color: 'text-red-400', text: 'FAILED' },
  IDLE: { color: 'text-zinc-500', text: 'IDLE' },
};

export function SubAgentCard({ label, status, totalTokens, isLast }: Props) {
  const badge = STATUS_BADGE[status] ?? STATUS_BADGE.IDLE;

  return (
    <div className="flex items-start">
      {/* Tree connector */}
      <div className="flex flex-col items-center mr-2 flex-shrink-0">
        <div className={`w-px bg-cyan-800 ${isLast ? 'h-3' : 'h-full'}`} />
        <div className="w-3 h-px bg-cyan-800" />
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800/50 rounded px-2 py-1.5 flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <span className="text-xs text-zinc-400 truncate">{label}</span>
          <span className={`text-[9px] font-mono ${badge.color}`}>{badge.text}</span>
        </div>
        <span className="text-[10px] text-zinc-600">{(totalTokens / 1000).toFixed(1)}k</span>
      </div>
    </div>
  );
}
