import { useState, type ReactNode } from 'react';

interface Props {
  title: React.ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  badge?: string | number;
}

export function CollapsibleSection({ title, defaultOpen = true, children, badge }: Props) {
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
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
        {badge !== undefined && (
          <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">{badge}</span>
        )}
      </button>
      <div
        className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-[2000px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}
      >
        {children}
      </div>
    </section>
  );
}
