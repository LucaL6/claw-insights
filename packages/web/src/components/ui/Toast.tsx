import { useEffect, useState } from 'react';

import { subscribe, type ToastMessage } from './toast-store';

const AUTO_DISMISS_MS = 4000;

const STYLE_MAP = {
  error: 'border-red/30 text-red',
  success: 'border-emerald/30 text-emerald',
  loading: 'border-sky/30 text-sky',
} as const;

const ICON_SIZE = 'w-4 h-4 flex-shrink-0';

function ToastIcon({ type }: { type: ToastMessage['type'] }) {
  if (type === 'error') {
    return (
      <svg className={ICON_SIZE} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M8 5v3.5M8 10.5v.5" />
      </svg>
    );
  }
  if (type === 'success') {
    return (
      <svg className={ICON_SIZE} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.5" />
        <path d="M5.5 8l2 2 3.5-4" />
      </svg>
    );
  }
  return (
    <svg className={`${ICON_SIZE} animate-spin`} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.5" opacity="0.25" />
      <path d="M14.5 8a6.5 6.5 0 0 0-6.5-6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return subscribe((action) => {
      if (action.kind === 'add') {
        const { msg } = action;
        setToasts((prev) => [...prev, msg]);
        if (msg.type !== 'loading') {
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== msg.id));
          }, AUTO_DISMISS_MS);
        }
      } else if (action.kind === 'dismiss') {
        setToasts((prev) => prev.filter((t) => t.id !== action.id));
      } else if (action.kind === 'replace') {
        const { id, msg } = action;
        setToasts((prev) => prev.map((t) => (t.id === id ? msg : t)));
        if (msg.type !== 'loading') {
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== msg.id));
          }, AUTO_DISMISS_MS);
        }
      }
    });
  }, []);

  if (toasts.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-xs font-medium shadow-lg border backdrop-blur-md bg-surface-solid/80 animate-fade-in ${STYLE_MAP[t.type]}`}
        >
          <ToastIcon type={t.type} />
          <span className="text-fg-secondary">{t.text}</span>
        </div>
      ))}
    </div>
  );
}
