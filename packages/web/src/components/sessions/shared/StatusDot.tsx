import { STATUS_DOT } from './constants';

interface StatusDotProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusDot({ status, size = 'md' }: StatusDotProps) {
  const sizeClass = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';
  return (
    <span className={`${sizeClass} rounded-full flex-shrink-0 ${STATUS_DOT[status] ?? 'bg-zinc-600'}`} />
  );
}
