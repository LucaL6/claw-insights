import { type ReactNode } from 'react';

import { useI18n } from '../../i18n/context';

export type ConfirmVariant = 'danger' | 'warning' | 'success' | 'info';

const VARIANT_STYLES: Record<ConfirmVariant, React.CSSProperties> = {
  danger: {
    backgroundColor: 'var(--red-bg)',
    color: 'var(--red)',
    border: '1px solid var(--red-border)',
  },
  warning: {
    backgroundColor: 'var(--orange-bg)',
    color: 'var(--orange)',
    border: '1px solid var(--orange-border)',
  },
  success: {
    backgroundColor: 'var(--emerald-bg)',
    color: 'var(--emerald)',
    border: '1px solid var(--emerald-border)',
  },
  info: {
    backgroundColor: 'var(--sky-bg)',
    color: 'var(--sky)',
    border: '1px solid var(--sky-border)',
  },
};

interface Props {
  title: string;
  children: ReactNode;
  confirmText?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  title,
  children,
  confirmText = 'Confirm',
  variant = 'info',
  loading = false,
  error = null,
  onConfirm,
  onCancel,
}: Props) {
  const { t } = useI18n();
  const buttonStyle = VARIANT_STYLES[variant];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-[4px]" onClick={onCancel}>
      <div
        className="rounded-2xl w-[420px] p-6 bg-surface-solid border border-edge shadow-[0_25px_50px_rgba(0,0,0,0.4)]"
        onClick={(e) => { e.stopPropagation(); }}
      >
        {title && <h2 className="text-lg font-semibold mb-4 text-fg">{title}</h2>}
        <div className="text-sm text-fg-secondary">{children}</div>
        {error && (
          <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ color: 'var(--red)', backgroundColor: 'var(--red-bg)', border: '1px solid var(--red-border)' }}>
            {error}
          </div>
        )}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-xs rounded-lg bg-elevated text-fg-secondary border border-edge"
          >
            {t('modal.cancel')}
          </button>
          <button
            onClick={() => { onConfirm(); }}
            disabled={loading}
            className="px-4 py-2 text-xs rounded-lg font-medium disabled:opacity-50"
            style={buttonStyle}
          >
            {loading ? t('modal.running') : confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
