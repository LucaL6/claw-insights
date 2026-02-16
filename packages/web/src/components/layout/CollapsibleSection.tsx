import { useState, type ReactNode } from 'react';

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
  /** Epoch ms of last data fetch — displays "Updated at HH:MM:SS" */
  updatedAt?: number;
}

export function CollapsibleSection({ title, defaultOpen = true, children, badge, headerRight, updatedAt }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mb-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left text-zinc-400 hover:text-zinc-200 transition-colors py-1"
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
          <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">{badge}</span>
        )}
        {updatedAt && (
          <span className="text-[9px] text-zinc-600 mono">
            updated {formatTime(updatedAt)}
          </span>
        )}
        {headerRight && (
          <span className="ml-auto" onClick={(e) => e.stopPropagation()}>
            {headerRight}
          </span>
        )}
      </button>
      <div
        className={`grid transition-all duration-200 ${open ? 'grid-rows-[1fr] opacity-100 mt-2' : 'grid-rows-[0fr] opacity-0'}`}
      >
      <div className={`${open ? '' : 'overflow-hidden'}`}>
        {children}
      </div>
      </div>
    </section>
  );
}
