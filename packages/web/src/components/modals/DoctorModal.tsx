import { useState } from 'react';
import { RunDoctorMutation } from '../../graphql/mutations';
import { ConfirmModal } from './ConfirmModal';
import { useI18n } from '../../i18n/context';
import { DoctorIcon } from '../ui/icons';
import { ModalIcon } from './ModalIcon';
import { useOperationMutation } from './useOperationMutation';

export function DoctorModal({ onClose }: { onClose: () => void }) {
  const { loading, error, run } = useOperationMutation(RunDoctorMutation, onClose);
  const { t } = useI18n();
  const [options, setOptions] = useState({
    deep: false,
    fix: false,
  });

  const toggle = (key: keyof typeof options) => setOptions((o) => ({ ...o, [key]: !o[key] }));

  const labels: Record<string, string> = {
    deep: t('modal.doctor.deep'),
    fix: t('modal.doctor.fix'),
  };

  return (
    <ConfirmModal
      title=""
      confirmText={t('modal.doctor.confirm')}
      variant="info"
      loading={loading}
      error={error}
      onConfirm={() => run({ options })}
      onCancel={onClose}
    >
      <div className="flex items-center gap-3 mb-4">
        <ModalIcon color="var(--sky)">
          <DoctorIcon className="w-5 h-5" />
        </ModalIcon>
        <div>
          <h3 className="text-sm font-semibold text-fg">{t('modal.doctor.title')}</h3>
          <p className="text-xs text-fg-muted">{t('modal.doctor.desc')}</p>
        </div>
      </div>
      <div className="space-y-2 mb-4">
        {Object.entries(options).map(([key, val]) => (
          <label key={key} className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer bg-overlay">
            <input type="checkbox" checked={val} onChange={() => toggle(key as keyof typeof options)} className="accent-cyan-500" />
            <span className="text-xs text-fg-secondary">{labels[key] ?? key}</span>
          </label>
        ))}
      </div>
    </ConfirmModal>
  );
}
