import { useState, type ReactNode } from 'react';
import { useI18n } from '../../i18n/context';

interface Props {
  sessions: ReactNode;
  metrics: ReactNode;
}

type Tab = 'sessions' | 'metrics';

export function LayoutTabs({ sessions, metrics }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const { t } = useI18n();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex border-b border-edge-subtle mb-2 flex-shrink-0" role="tablist">
        <button
          id="tab-sessions"
          role="tab"
          aria-selected={activeTab === 'sessions'}
          aria-controls="tabpanel-sessions"
          onClick={() => setActiveTab('sessions')}
          className={`text-xs font-semibold px-3 py-1.5 border-b-2 transition-colors ${
            activeTab === 'sessions'
              ? 'text-fg border-indigo-400'
              : 'text-fg-dim border-transparent hover:text-fg-muted'
          }`}
        >
          {t('nav.sessions')}
        </button>
        <button
          id="tab-metrics"
          role="tab"
          aria-selected={activeTab === 'metrics'}
          aria-controls="tabpanel-metrics"
          onClick={() => setActiveTab('metrics')}
          className={`text-xs font-semibold px-3 py-1.5 border-b-2 transition-colors ${
            activeTab === 'metrics'
              ? 'text-fg border-indigo-400'
              : 'text-fg-dim border-transparent hover:text-fg-muted'
          }`}
        >
          {t('nav.metrics')}
        </button>
      </div>
      <div
        id="tabpanel-sessions"
        role="tabpanel"
        aria-labelledby="tab-sessions"
        className={`flex-1 min-h-0 overflow-y-auto sb ${activeTab === 'sessions' ? '' : 'hidden'}`}
      >
        {sessions}
      </div>
      <div
        id="tabpanel-metrics"
        role="tabpanel"
        aria-labelledby="tab-metrics"
        className={`flex-1 min-h-0 overflow-y-auto sb ${activeTab === 'metrics' ? '' : 'hidden'}`}
      >
        {metrics}
      </div>
    </div>
  );
}
