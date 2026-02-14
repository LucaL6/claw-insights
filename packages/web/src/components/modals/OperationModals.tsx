import { useState } from 'react';
import { useMutation } from 'urql';
import { ConfirmModal } from './ConfirmModal';

const RestartMutation = `mutation { restartGateway { success message output duration } }`;
const UpdateMutation = `mutation { updateGateway { success message output duration } }`;
const DoctorMutation = `mutation RunDoctor($options: DoctorOptions!) {
  runDoctor(options: $options) { success message output duration }
}`;

interface ModalState {
  type: 'restart' | 'doctor' | 'update' | null;
}

export function useOperationModals() {
  const [modal, setModal] = useState<ModalState>({ type: null });
  const [result, setResult] = useState<{ success: boolean; output: string } | null>(null);

  const open = (type: 'restart' | 'doctor' | 'update') => {
    setResult(null);
    setModal({ type });
  };
  const close = () => setModal({ type: null });

  return { modal: modal.type, open, close, result, setResult };
}

export function RestartModal({ onClose }: { onClose: () => void }) {
  const [, execute] = useMutation(RestartMutation);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await execute({});
    setLoading(false);
    onClose();
  };

  return (
    <ConfirmModal
      title="Restart Gateway"
      confirmText="Restart"
      confirmColor="bg-amber-600 hover:bg-amber-500"
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <p>This will restart the OpenClaw Gateway process. Active sessions will reconnect automatically.</p>
    </ConfirmModal>
  );
}

export function UpdateModal({ onClose }: { onClose: () => void }) {
  const [, execute] = useMutation(UpdateMutation);
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    setLoading(true);
    await execute({});
    setLoading(false);
    onClose();
  };

  return (
    <ConfirmModal
      title="Update OpenClaw"
      confirmText="Update"
      confirmColor="bg-emerald-600 hover:bg-emerald-500"
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <p>This will update OpenClaw to the latest version and restart the Gateway.</p>
    </ConfirmModal>
  );
}

export function DoctorModal({ onClose }: { onClose: () => void }) {
  const [, execute] = useMutation(DoctorMutation);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState({ channelCheck: true, securityAudit: false, deepProbe: false, autoFix: false });

  const toggle = (key: keyof typeof options) => setOptions((o) => ({ ...o, [key]: !o[key] }));

  const handleConfirm = async () => {
    setLoading(true);
    await execute({ options });
    setLoading(false);
    onClose();
  };

  return (
    <ConfirmModal title="Run Doctor" loading={loading} onConfirm={handleConfirm} onCancel={onClose}>
      <div className="space-y-2">
        {Object.entries(options).map(([key, val]) => (
          <label key={key} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={val}
              onChange={() => toggle(key as keyof typeof options)}
              className="accent-cyan-500"
            />
            <span>{key.replace(/([A-Z])/g, ' $1').trim()}</span>
          </label>
        ))}
      </div>
    </ConfirmModal>
  );
}
