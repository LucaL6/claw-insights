const LEVEL_COLORS: Record<string, string> = {
  DEBUG: 'text-zinc-600',
  INFO: 'text-zinc-400',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
};

const MODULE_COLORS: Record<string, string> = {
  'agent/embedded': 'text-cyan-400',
  'agent': 'text-cyan-400',
  'diagnostic': 'text-violet-400',
  'tools': 'text-amber-400',
  'exec': 'text-amber-400',
  'cron': 'text-emerald-400',
  'plugins': 'text-teal-400',
  'system': 'text-zinc-500',
};

const ROW_BG: Record<string, string> = {
  ERROR: 'bg-red-950/30',
  WARN: 'bg-amber-950/20',
};

interface Props {
  time: string;
  level: string;
  module: string;
  message: string;
}

export function LogEntryRow({ time, level, module, message }: Props) {
  const moduleColor = MODULE_COLORS[module] ?? 'text-zinc-500';
  const rowBg = ROW_BG[level] ?? '';

  return (
    <div className={`flex gap-2 text-[11px] font-mono leading-5 px-2 ${rowBg} hover:bg-zinc-800/50`}>
      <span className="text-zinc-600 flex-shrink-0 w-20">{time}</span>
      <span className={`flex-shrink-0 w-12 font-bold ${LEVEL_COLORS[level] ?? 'text-zinc-500'}`}>{level}</span>
      <span className={`flex-shrink-0 w-28 truncate ${moduleColor}`}>{module}</span>
      <span className="text-zinc-300 truncate">{message}</span>
    </div>
  );
}
