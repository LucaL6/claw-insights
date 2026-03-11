import { useI18n } from '../../i18n/context';
import { StatusDot } from './shared/StatusDot';

interface SessionEmptyStateProps {
  /** 'active' shows "no active sessions", 'all' shows "no session records" */
  mode: 'active' | 'all';
}

export function SessionEmptyState({ mode }: SessionEmptyStateProps) {
  const { t } = useI18n();

  const title = mode === 'active' ? t('sessions.empty.activeTitle') : t('sessions.empty.allTitle');
  const subtitle = mode === 'active' ? t('sessions.empty.activeSubtitle') : t('sessions.empty.allSubtitle');

  return (
    <div className="border border-dashed border-border rounded-xl p-8 flex flex-col items-center justify-center gap-4">
      {/* Icon with pulse ring */}
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-surface-solid flex items-center justify-center">
          <svg className="w-5 h-5 text-fg-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155"
            />
          </svg>
        </div>
        <span className="absolute inset-0 w-10 h-10 rounded-full border border-border animate-pulse" />
      </div>

      {/* Text */}
      <div className="text-center">
        <p className="text-sm text-fg-muted">{title}</p>
        <p className="text-xs text-fg-dim mt-1">{subtitle}</p>
      </div>

      {/* Status legend */}
      <div className="flex items-center gap-4 mt-1">
        <div className="flex items-center gap-1.5">
          <StatusDot status="ACTIVE" size="sm" />
          <span className="text-[11px] text-fg-dim">
            Active <span className="text-fg-dim/60">&lt;30m</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusDot status="IDLE" size="sm" />
          <span className="text-[11px] text-fg-dim">
            Idle <span className="text-fg-dim/60">30m–24h</span>
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <StatusDot status="DONE" size="sm" />
          <span className="text-[11px] text-fg-dim">
            Done <span className="text-fg-dim/60">&gt;24h</span>
          </span>
        </div>
      </div>
    </div>
  );
}
