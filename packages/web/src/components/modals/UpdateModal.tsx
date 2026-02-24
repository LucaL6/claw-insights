import { UpdateGatewayMutation } from '../../graphql/mutations';
import { useI18n } from '../../i18n/context';
import { DownloadIcon } from '../ui/icons';
import { CommandPreview } from './CommandPreview';
import { ConfirmModal } from './ConfirmModal';
import { ModalIcon } from './ModalIcon';
import { useOperationMutation } from './useOperationMutation';

export interface UpdateModalProps {
  onClose: () => void;
  currentVersion: string;
  latestVersion: string;
}

export function UpdateModal({ onClose, currentVersion, latestVersion }: UpdateModalProps) {
  const { loading, error, run } = useOperationMutation(UpdateGatewayMutation, onClose);
  const { t } = useI18n();

  return (
    <ConfirmModal
      title=""
      confirmText={t('modal.update.confirm')}
      variant="success"
      loading={loading}
      error={error}
      onConfirm={() => { void run(); }}
      onCancel={onClose}
    >
      <div className="flex items-center gap-3 mb-4">
        <ModalIcon color="var(--emerald)">
          <DownloadIcon className="w-5 h-5" />
        </ModalIcon>
        <div>
          <h3 className="text-sm font-semibold text-fg">{t('modal.update.title')}</h3>
          <p className="text-xs text-fg-muted">{currentVersion} → {latestVersion}</p>
        </div>
      </div>
      <CommandPreview lines={[t('modal.update.command'), t('modal.update.commandNote')]} />
    </ConfirmModal>
  );
}
