const LEVEL_COLORS: Record<string, string> = {
  DEBUG: 'text-zinc-500',
  INFO: 'text-zinc-400',
  WARN: 'text-yellow-400',
  ERROR: 'text-red-400',
};

const MODULE_COLORS: Record<string, string> = {
  'agent/embedded': 'text-blue-400',
  'agent': 'text-blue-400',
  'diagnostic': 'text-purple-400',
  'tools': 'text-amber-400',
  'exec': 'text-amber-400',
  'cron': 'text-amber-400',
  'plugins': 'text-cyan-400',
  'system': 'text-zinc-500',
};

const ROW_STYLES: Record<string, string> = {
  ERROR: 'bg-red-500/5 border-l-2 border-red-500/30',
  WARN: 'bg-yellow-500/5 border-l-2 border-yellow-500/30',
};

const MESSAGE_COLORS: Record<string, string> = {
  ERROR: 'text-red-300/70',
  WARN: 'text-yellow-300/70',
  INFO: 'text-zinc-400',
  DEBUG: 'text-zinc-400',
};

interface Props {
  time: string;
  level: string;
  module: string;
  message: string;
}

export function LogEntryRow({ time, level, module, message }: Props) {
  const moduleColor = MODULE_COLORS[module] ?? 'text-zinc-500';
  const rowStyle = ROW_STYLES[level] ?? '';
  const messageColor = MESSAGE_COLORS[level] ?? 'text-zinc-400';

  return (
    <div className={`flex gap-2 text-[11px] font-mono leading-5 py-0.5 px-2 rounded ${rowStyle} hover:bg-zinc-800/40`}>
      <span className="text-zinc-600 flex-shrink-0 w-20">{time}</span>
      <span className={`flex-shrink-0 w-11 font-bold ${LEVEL_COLORS[level] ?? 'text-zinc-500'}`}>{level}</span>
      <span className={`flex-shrink-0 w-28 truncate ${moduleColor}`}>{module}</span>
      <span className={`${messageColor} truncate`}>{message}</span>
    </div>
  );
}
