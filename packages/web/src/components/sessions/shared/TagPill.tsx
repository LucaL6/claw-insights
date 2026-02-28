import { TAG_STYLES, type TagVariant } from './constants';

interface TagPillProps {
  children: React.ReactNode;
  variant: TagVariant;
  size?: 'sm' | 'md';
}

export function TagPill({ children, variant, size = 'md' }: TagPillProps) {
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-xs px-2 py-0.5';
  const s = TAG_STYLES[variant];
  return (
    <span
      className={`${sizeClass} rounded whitespace-nowrap flex-shrink-0`}
      style={{ backgroundColor: s.bg, color: s.color, border: `1px solid ${s.border}` }}
    >
      {children}
    </span>
  );
}
