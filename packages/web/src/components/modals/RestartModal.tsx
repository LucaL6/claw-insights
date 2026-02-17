import { useState } from 'react';
import { useMutation } from 'urql';
import { graphql } from '../../generated/gql';
import { ConfirmModal } from './ConfirmModal';
import { useI18n } from '../../i18n/context';
import { RestartIcon } from '../ui/icons';
import { ModalIcon } from './ModalIcon';
import { CommandPreview } from './CommandPreview';

const RestartMutation = graphql(/* GraphQL */ `mutation { restartGateway { success message output duration } }`);

export function RestartModal({ onClose }: { onClose: () => void }) {
  const [, execute] = useMutation(RestartMutation);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();

  const handleConfirm = async () => {
    setLoading(true);
    await execute({});
    setLoading(false);
    onClose();
  };

  return (
    <ConfirmModal
      title=""
      confirmText={t('modal.restart.confirm')}
      confirmStyle={{
        backgroundColor: 'var(--orange-bg)',
        color: 'var(--orange)',
        border: '1px solid var(--orange-border)',
      }}
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="flex items-center gap-3 mb-4">
        <ModalIcon color="var(--orange)">
          <RestartIcon className="w-5 h-5" />
        </ModalIcon>
        <div>
          <h3 className="text-sm font-semibold text-fg">{t('modal.restart.title')}</h3>
          <p className="text-xs text-fg-muted">{t('modal.restart.desc')}</p>
        </div>
      </div>
      <CommandPreview lines={[t('modal.restart.command'), t('modal.restart.commandNote')]} />
    </ConfirmModal>
  );
}
