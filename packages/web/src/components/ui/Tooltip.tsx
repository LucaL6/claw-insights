import { type ReactNode, useId } from 'react';

interface TooltipProps {
  text: string;
  detail?: string;
  children: ReactNode;
  align?: 'left' | 'center' | 'right';
}

export function Tooltip({ text, detail, children, align = 'center' }: TooltipProps) {
  const id = useId();

  const alignClass = {
    left: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    right: 'right-0',
  }[align];

  return (
    <span className="relative inline-flex group/tip" aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className={`absolute top-full mt-1.5 z-50 w-max max-w-[240px] px-2.5 py-2 rounded-md
          invisible opacity-0
          group-hover/tip:visible group-hover/tip:opacity-100
          group-focus-within/tip:visible group-focus-within/tip:opacity-100
          transition-opacity duration-150 motion-reduce:transition-none
          pointer-events-none
          bg-[var(--chart-tooltip-bg)] border border-[var(--chart-tooltip-border)] shadow-tooltip
          ${alignClass}`}
      >
        <span className="block text-xs leading-snug text-[var(--chart-tooltip-text)]">{text}</span>
        {detail && (
          <span className="block text-xs mt-1 leading-snug text-[var(--chart-tooltip-dim)]">{detail}</span>
        )}
      </span>
    </span>
  );
}
