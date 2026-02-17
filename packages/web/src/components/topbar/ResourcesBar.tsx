import { useI18n } from '../../i18n/context';
import { InfoTooltip } from '../ui/InfoTooltip';

interface Resources {
  cpu: number;
  memoryMB: number;
}

interface ResourcesBarProps {
  resources?: Resources | null;
  fetching: boolean;
}

export function ResourcesBar({ resources, fetching }: ResourcesBarProps) {
  const { t } = useI18n();

  if (fetching) {
    return (
      <div className="flex items-center gap-2 text-[10px]">
        <div className="flex items-center gap-3 px-3 py-1 rounded-md bg-surface border border-edge-subtle">
          <span className="text-fg-dim">{t('topbar.cpu')}</span>
          <span className="inline-block w-8 h-3 rounded animate-pulse bg-skeleton" />
          <span className="w-px h-3 bg-edge" />
          <span className="text-fg-dim">{t('topbar.mem')}</span>
          <span className="inline-block w-8 h-3 rounded animate-pulse bg-skeleton" />
        </div>
      </div>
    );
  }

  if (!resources) return null;

  return (
    <div className="flex items-center gap-2 text-[10px]">
      <div className="flex items-center gap-3 px-3 py-1 rounded-md bg-surface border border-edge-subtle">
        <span className="text-fg-dim">{t('topbar.cpu')}</span>
        <span className="mono text-fg-secondary">{resources.cpu.toFixed(1)}%</span>
        <InfoTooltip label="Gateway 进程 CPU 使用率" detail="ps -o pcpu= -p <gateway_pid> · real-time" />
        <span className="w-px h-3 bg-edge" />
        <span className="text-fg-dim">{t('topbar.mem')}</span>
        <span className="mono text-fg-secondary">{resources.memoryMB}M</span>
        <InfoTooltip label="Gateway 进程内存占用 (RSS)" detail="ps -o rss= -p <gateway_pid> · real-time" />
      </div>
    </div>
  );
}
