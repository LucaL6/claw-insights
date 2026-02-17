import { useState } from 'react';
import { useMutation } from 'urql';
import { graphql } from '../../generated/gql';
import { ConfirmModal } from './ConfirmModal';
import { useI18n } from '../../i18n/context';
import { DoctorIcon } from '../ui/icons';
import { ModalIcon } from './ModalIcon';

const DoctorMutation = graphql(/* GraphQL */ `mutation RunDoctor($options: DoctorOptions!) {
  runDoctor(options: $options) { success message output duration }
}`);

export function DoctorModal({ onClose }: { onClose: () => void }) {
  const [, execute] = useMutation(DoctorMutation);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  const [options, setOptions] = useState({
    channelCheck: true,
    securityAudit: true,
    deepProbe: false,
    autoFix: false,
  });

  const toggle = (key: keyof typeof options) => setOptions((o) => ({ ...o, [key]: !o[key] }));

  const handleConfirm = async () => {
    setLoading(true);
    await execute({ options });
    setLoading(false);
    onClose();
  };

  const labels: Record<string, string> = {
    channelCheck: t('modal.doctor.channelCheck'),
    securityAudit: t('modal.doctor.securityAudit'),
    deepProbe: t('modal.doctor.deepProbe'),
    autoFix: t('modal.doctor.autoFix'),
  };

  return (
    <ConfirmModal
      title=""
      confirmText={t('modal.doctor.confirm')}
      confirmStyle={{
        backgroundColor: 'var(--sky-bg)',
        color: 'var(--sky)',
        border: '1px solid var(--sky-border)',
      }}
      loading={loading}
      onConfirm={handleConfirm}
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
          <label
            key={key}
            className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer bg-overlay"
          >
            <input
              type="checkbox"
              checked={val}
              onChange={() => toggle(key as keyof typeof options)}
              className="accent-cyan-500"
            />
            <span className="text-xs text-fg-secondary">{labels[key] ?? key}</span>
          </label>
        ))}
      </div>
    </ConfirmModal>
  );
}
