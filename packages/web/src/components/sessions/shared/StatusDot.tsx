import { STATUS_DOT } from './constants';

interface StatusDotProps {
  status: string;
  size?: 'sm' | 'md';
  animate?: boolean;
}

export function StatusDot({ status, size = 'md', animate }: StatusDotProps) {
  const sizeClass = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  const dot = STATUS_DOT[status] ?? { bg: 'var(--status-idle)' };
  return (
    <span
      className={`${sizeClass} rounded-full flex-shrink-0 ${animate ? 'animate-pulse' : ''}`}
      style={{ backgroundColor: dot.bg, boxShadow: dot.shadow }}
    />
  );
}
