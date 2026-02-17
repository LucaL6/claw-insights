import { useState, useEffect, useCallback } from 'react';
import { Provider } from 'urql';
import { client } from './lib/urql-client';
import { ThemeProvider } from './theme/context';
import { I18nProvider } from './i18n/context';
import { useHashRoute, type Page, type Route } from './hooks/useHashRoute';
import { MainLayout } from './components/layout/MainLayout';
import { TopBar } from './components/topbar/TopBar';
import { SessionPanel } from './components/sessions/SessionPanel';
import { MetricsSection } from './components/charts/MetricsSection';
import { useOperationModals, RestartModal, UpdateModal, DoctorModal } from './components/modals/OperationModals';
import { LogPage } from './components/logs/LogPage';
import type { MetricsRange } from './components/charts/GranularityPicker';

const VALID_RANGES: MetricsRange[] = ['ONE_HOUR', 'SIX_HOUR', 'TWELVE_HOUR', 'TWENTY_FOUR_HOUR'];

function Dashboard({ navigate, route }: { navigate: (h: string) => void; route: Route }) {
  const { modal, open, close } = useOperationModals();
  const initialRange = VALID_RANGES.includes(route.params.range as MetricsRange)
    ? (route.params.range as MetricsRange)
    : 'TWENTY_FOUR_HOUR';
  const [range, setRange] = useState<MetricsRange>(initialRange);
  const [sessionsReady, setSessionsReady] = useState(false);
  const [metricsReady, setMetricsReady] = useState(false);

  const onSessionsReady = useCallback(() => setSessionsReady(true), []);
  const onMetricsReady = useCallback(() => setMetricsReady(true), []);

  useEffect(() => {
    if (sessionsReady && metricsReady) {
      document.body.setAttribute('data-ready', 'true');
    }
    return () => document.body.removeAttribute('data-ready');
  }, [sessionsReady, metricsReady]);

  return (
    <>
      <MainLayout
        topBar={<TopBar currentPage="dashboard" onNavigate={navigate} onAction={open} metricsRange={range} />}
        sessions={<SessionPanel onReady={onSessionsReady} />}
        metrics={<MetricsSection range={range} onRangeChange={setRange} navigate={navigate} onReady={onMetricsReady} />}
      />
      {modal === 'restart' && <RestartModal onClose={close} />}
      {modal === 'update' && <UpdateModal onClose={close} />}
      {modal === 'doctor' && <DoctorModal onClose={close} />}
    </>
  );
}

function App() {
  const { route, navigate } = useHashRoute();
  return (
    <ThemeProvider>
      <I18nProvider>
        <Provider value={client}>
          {route.page === 'dashboard'
            ? <Dashboard navigate={navigate} route={route} />
            : (
              <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
                <header
                  className="backdrop-blur-sm sticky top-0 z-50 px-5 py-2"
                  style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface-solid)', opacity: 0.97 }}
                >
                  <TopBar currentPage="logs" onNavigate={navigate} metricsRange="TWENTY_FOUR_HOUR" />
                </header>
                <LogPage route={route} navigate={navigate} />
              </div>
            )
          }
        </Provider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
