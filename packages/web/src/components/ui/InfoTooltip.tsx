interface InfoTooltipProps {
  label: string;
  detail?: string;
  alignRight?: boolean;
}

export function InfoTooltip({ label, detail, alignRight = false }: InfoTooltipProps) {
  return (
    <span className="relative inline-flex items-center group/info ml-1">
      <span
        className="cursor-help hover:opacity-80 transition-opacity text-[11px] leading-none select-none text-fg-dim"
      >
        ⓘ
      </span>
      <span
        className={`absolute top-full mt-1.5 z-50 w-[220px] px-2.5 py-2 rounded-md
          invisible opacity-0 group-hover/info:visible group-hover/info:opacity-100
          transition-opacity duration-150 pointer-events-none
          ${alignRight ? 'right-0' : 'left-0'}`}
        style={{
          backgroundColor: 'var(--chart-tooltip-bg)',
          border: '1px solid var(--chart-tooltip-border)',
          boxShadow: 'var(--shadow-tooltip)',
        }}
      >
        <span className="block text-[11px] leading-snug" style={{ color: 'var(--chart-tooltip-text)' }}>{label}</span>
        {detail && (
          <span className="block text-[10px] font-mono mt-1 leading-snug" style={{ color: 'var(--chart-tooltip-dim)' }}>{detail}</span>
        )}
      </span>
    </span>
  );
}
