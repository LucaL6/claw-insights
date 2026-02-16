import { type ReactNode } from 'react';

interface Props {
  title: string;
  children: ReactNode;
  confirmText?: string;
  confirmStyle?: React.CSSProperties;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  children,
  confirmText = 'Confirm',
  confirmStyle,
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[4px]" onClick={onCancel}>
      <div
        className="rounded-2xl w-[420px] p-6"
        style={{
          backgroundColor: 'var(--bg-surface-solid)',
          border: '1px solid var(--border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.4)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>{title}</h2>}
        <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{children}</div>
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs rounded-lg"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
            }}
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="px-4 py-2 text-xs rounded-lg font-medium disabled:opacity-50"
            style={confirmStyle ?? {
              backgroundColor: 'var(--sky-bg)',
              color: 'var(--sky)',
              border: '1px solid var(--sky-border)',
            }}
          >
            {loading ? 'Running...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
