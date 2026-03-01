import { type ReactNode, useState } from 'react';

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

interface Props {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  badge?: string | number;
  headerRight?: ReactNode;
  updatedAt?: number;
}

export function CollapsibleSection({ title, defaultOpen = true, children, badge, headerRight, updatedAt }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mb-4">
      <button
        onClick={() => {
          setOpen(!open);
        }}
        className="flex items-center gap-2 w-full text-left transition-colors py-1 text-fg-muted"
      >
        <svg
          className={`w-3 h-3 transition-transform ${open ? 'rotate-90' : ''}`}
          fill="currentColor"
          viewBox="0 0 8 12"
        >
          <path d="M0 0 L8 6 L0 12 Z" />
        </svg>
        <span className="text-[13px] font-semibold uppercase tracking-[0.8px]">{title}</span>
        {badge !== undefined && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-emerald/15 text-emerald font-medium">{badge}</span>
        )}
        {updatedAt && <span className="text-xs mono text-fg-dim">updated {formatTime(updatedAt)}</span>}
        {headerRight && (
          <span
            className="ml-auto"
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            {headerRight}
          </span>
        )}
      </button>
      <div
        className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className={open ? 'min-w-0' : 'overflow-hidden min-w-0'}>{children}</div>
      </div>
    </section>
  );
}
