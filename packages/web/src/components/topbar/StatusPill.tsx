import { useI18n } from '../../i18n/context';

interface StatusPillProps {
  running?: boolean;
  fetching: boolean;
}

export function StatusPill({ running, fetching }: StatusPillProps) {
  const { t } = useI18n();

  if (fetching) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-elevated border border-edge">
        <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-fg-dim" />
        <span className="text-[11px] font-medium text-fg-muted">{t('topbar.connecting')}</span>
      </div>
    );
  }

  if (running) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-emerald-bg border border-emerald-border">
        <span className="w-1.5 h-1.5 rounded-full pulse-dot bg-emerald" />
        <span className="text-[11px] font-medium text-emerald">{t('topbar.up')}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-bg border border-red-border">
      <span className="w-1.5 h-1.5 rounded-full bg-red" />
      <span className="text-[11px] font-medium text-red">{t('topbar.down')}</span>
    </div>
  );
}
