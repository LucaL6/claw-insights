import { RestartGatewayMutation } from '../../graphql/mutations';
import { ConfirmModal } from './ConfirmModal';
import { useI18n } from '../../i18n/context';
import { RestartIcon } from '../ui/icons';
import { ModalIcon } from './ModalIcon';
import { CommandPreview } from './CommandPreview';
import { useOperationMutation } from './useOperationMutation';

export function RestartModal({ onClose }: { onClose: () => void }) {
  const { loading, error, run } = useOperationMutation(RestartGatewayMutation, onClose);
  const { t } = useI18n();

  return (
    <ConfirmModal
      title=""
      confirmText={t('modal.restart.confirm')}
      variant="warning"
      loading={loading}
      error={error}
      onConfirm={run}
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
