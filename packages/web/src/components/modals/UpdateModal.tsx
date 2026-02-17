import { useState } from 'react';
import { useMutation, useQuery } from 'urql';
import { graphql } from '../../generated/gql';
import { GatewayQuery } from '../../graphql/queries';
import { ConfirmModal } from './ConfirmModal';
import { useI18n } from '../../i18n/context';
import { DownloadIcon } from '../ui/icons';
import { ModalIcon } from './ModalIcon';
import { CommandPreview } from './CommandPreview';

const UpdateMutation = graphql(/* GraphQL */ `mutation { updateGateway { success message output duration } }`);

export function UpdateModal({ onClose }: { onClose: () => void }) {
  const [, execute] = useMutation(UpdateMutation);
  const [loading, setLoading] = useState(false);
  const { t } = useI18n();
  const [gw] = useQuery({ query: GatewayQuery });
  const gateway = gw.data?.gateway;
  const current = gateway?.version ?? '...';
  const latest = gateway?.latestVersion ?? gateway?.updateAvailable ?? '...';

  const handleConfirm = async () => {
    setLoading(true);
    await execute({});
    setLoading(false);
    onClose();
  };

  return (
    <ConfirmModal
      title=""
      confirmText={t('modal.update.confirm')}
      confirmStyle={{
        backgroundColor: 'var(--emerald-bg)',
        color: 'var(--emerald)',
        border: '1px solid var(--emerald-border)',
      }}
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="flex items-center gap-3 mb-4">
        <ModalIcon color="var(--emerald)">
          <DownloadIcon className="w-5 h-5" />
        </ModalIcon>
        <div>
          <h3 className="text-sm font-semibold text-fg">{t('modal.update.title')}</h3>
          <p className="text-xs text-fg-muted">{current} → {latest}</p>
        </div>
      </div>
      <CommandPreview lines={[t('modal.update.command'), t('modal.update.commandNote')]} />
    </ConfirmModal>
  );
}
