import { useState } from 'react';
import { useQuery, useMutation } from 'urql';
import { GatewayQuery } from '../../graphql/queries';
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

function ModalIcon({ bg, borderColor, children }: { bg: string; borderColor: string; children: React.ReactNode }) {
  return (
    <div className={`w-10 h-10 ${bg} border ${borderColor} rounded-xl flex items-center justify-center flex-shrink-0`}>
      {children}
    </div>
  );
}

function CommandPreview({ lines }: { lines: string[] }) {
  return (
    <div className="bg-zinc-800/60 border border-zinc-700/50 rounded-lg p-3 mb-4 font-mono text-xs text-zinc-400">
      {lines.map((line, i) => (
        <div key={i} className={line.startsWith('#') ? 'text-zinc-600 mt-1' : ''}>{line}</div>
      ))}
    </div>
  );
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
      title=""
      confirmText="确认重启"
      confirmColor="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/30"
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="flex items-center gap-3 mb-4">
        <ModalIcon bg="bg-orange-500/10" borderColor="border-orange-500/20">
          <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </ModalIcon>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Restart Gateway</h3>
          <p className="text-xs text-zinc-500">所有活跃 session 会短暂中断</p>
        </div>
      </div>
      <CommandPreview lines={['$ openclaw gateway restart', '# Active sessions will reconnect']} />
    </ConfirmModal>
  );
}

export function UpdateModal({ onClose }: { onClose: () => void }) {
  const [, execute] = useMutation(UpdateMutation);
  const [loading, setLoading] = useState(false);
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
      confirmText="确认更新"
      confirmColor="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30"
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="flex items-center gap-3 mb-4">
        <ModalIcon bg="bg-emerald-500/10" borderColor="border-emerald-500/20">
          <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </ModalIcon>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Update OpenClaw</h3>
          <p className="text-xs text-zinc-500">{current} → {latest}</p>
        </div>
      </div>
      <CommandPreview lines={[`$ pnpm update openclaw@${latest}`, '# Gateway will restart automatically']} />
    </ConfirmModal>
  );
}

export function DoctorModal({ onClose }: { onClose: () => void }) {
  const [, execute] = useMutation(DoctorMutation);
  const [loading, setLoading] = useState(false);
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
    channelCheck: 'Channel 连通性检查',
    securityAudit: 'Security audit',
    deepProbe: 'Deep probe',
    autoFix: 'Auto-fix',
  };

  return (
    <ConfirmModal
      title=""
      confirmText="运行检查"
      confirmColor="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 border border-cyan-500/30"
      loading={loading}
      onConfirm={handleConfirm}
      onCancel={onClose}
    >
      <div className="flex items-center gap-3 mb-4">
        <ModalIcon bg="bg-cyan-500/10" borderColor="border-cyan-500/20">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </ModalIcon>
        <div>
          <h3 className="text-sm font-semibold text-zinc-100">Run Diagnostics</h3>
          <p className="text-xs text-zinc-500">健康检查 + 自动修复</p>
        </div>
      </div>
      <div className="space-y-2 mb-4">
        {Object.entries(options).map(([key, val]) => (
          <label key={key} className="flex items-center gap-2 px-3 py-2 bg-zinc-800/40 rounded-lg cursor-pointer hover:bg-zinc-800/60">
            <input
              type="checkbox"
              checked={val}
              onChange={() => toggle(key as keyof typeof options)}
              className="accent-cyan-500"
            />
            <span className="text-xs text-zinc-300">{labels[key] ?? key}</span>
          </label>
        ))}
      </div>
    </ConfirmModal>
  );
}
