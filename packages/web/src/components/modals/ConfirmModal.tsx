import { type ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  confirmText?: string;
  confirmColor?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  children,
  confirmText = 'Confirm',
  confirmColor = 'bg-cyan-600 hover:bg-cyan-500',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[4px]" onClick={onCancel}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-[420px] p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="text-lg font-semibold text-zinc-100 mb-4">{title}</h2>}
        <div className="text-sm text-zinc-400">{children}</div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs bg-zinc-800 text-zinc-400 border border-zinc-700 rounded-lg hover:bg-zinc-700"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-xs rounded-lg font-medium ${confirmColor} disabled:opacity-50`}
          >
            {loading ? 'Running...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
