import {
  Children,
  cloneElement,
  type ElementType,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useId,
} from 'react';

interface TooltipProps {
  text: string;
  detail?: string;
  children: ReactNode;
  align?: 'left' | 'center' | 'right';
  position?: 'bottom' | 'right';
  as?: ElementType;
}

export function Tooltip({
  text,
  detail,
  children,
  align = 'center',
  position = 'bottom',
  as: Tag = 'span',
}: TooltipProps) {
  const id = useId();

  const positionClass =
    position === 'right'
      ? 'left-full ml-1.5 top-1/2 -translate-y-1/2'
      : `top-full mt-1.5 ${{ left: 'left-0', center: 'left-1/2 -translate-x-1/2', right: 'right-0' }[align]}`;

  // Inject aria-describedby into the child element so screen readers
  // associate the tooltip with the actual focusable trigger, not the wrapper.
  const child = Children.only(children);
  const enhancedChild = isValidElement(child)
    ? cloneElement(child as ReactElement<Record<string, unknown>>, { 'aria-describedby': id })
    : children;

  return (
    <Tag className="relative inline-flex group/tip">
      {enhancedChild}
      <span
        id={id}
        role="tooltip"
        className={`absolute z-50 w-max max-w-[240px] px-2.5 py-2 rounded-md
          invisible opacity-0
          group-hover/tip:visible group-hover/tip:opacity-100
          group-has-[:focus-visible]/tip:visible group-has-[:focus-visible]/tip:opacity-100
          transition-opacity duration-150 motion-reduce:transition-none
          pointer-events-none
          bg-[var(--chart-tooltip-bg)] border border-[var(--chart-tooltip-border)] shadow-tooltip
          ${positionClass}`}
      >
        <span className="block text-xs leading-snug text-[var(--chart-tooltip-text)]">{text}</span>
        {detail && <span className="block text-xs mt-1 leading-snug text-[var(--chart-tooltip-dim)]">{detail}</span>}
      </span>
    </Tag>
  );
}
