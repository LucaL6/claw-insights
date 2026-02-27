import { useEffect, useState } from 'react';

import { subscribe, type ToastMessage } from './toast-store';

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    return subscribe((msg) => {
      setToasts((prev) => [...prev, msg]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== msg.id));
      }, 4000);
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
          className={`pointer-events-auto px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg backdrop-blur-sm animate-fade-in ${
            t.type === 'error' ? 'bg-red-500/90 text-white' : 'bg-emerald-500/90 text-white'
          }`}
        >
          {t.type === 'error' ? '⚠ ' : '✓ '}
          {t.text}
        </div>
      ))}
    </div>
  );
}
