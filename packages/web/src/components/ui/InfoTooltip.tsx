interface InfoTooltipProps {
  /** Primary explanation (plain language) */
  label: string;
  /** Technical detail (smaller, dimmer) */
  detail?: string;
  /** Popover opens to the left instead of right */
  alignRight?: boolean;
}

export function InfoTooltip({ label, detail, alignRight = false }: InfoTooltipProps) {
  return (
    <span className="relative inline-flex items-center group/info ml-1">
      <span className="cursor-help text-zinc-600 hover:text-zinc-400 transition-colors text-[11px] leading-none select-none">
        ⓘ
      </span>
      <span
        className={`absolute top-full mt-1.5 z-50 w-[220px] px-2.5 py-2 rounded-md
          bg-zinc-800 border border-zinc-700 shadow-lg shadow-black/40
          invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100
          transition-opacity duration-150 pointer-events-none
          ${alignRight ? 'right-0' : 'left-0'}`}
      >
        <span className="block text-[11px] text-zinc-300 leading-snug">{label}</span>
        {detail && (
          <span className="block text-[10px] text-zinc-500 font-mono mt-1 leading-snug">{detail}</span>
        )}
      </span>
    </span>
  );
}
