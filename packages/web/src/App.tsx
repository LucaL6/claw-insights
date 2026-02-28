import { useCallback, useEffect, useState } from 'react';
import { Provider } from 'urql';

import type { MetricsRange } from './components/charts/metrics/GranularityPicker';
import { MetricsSection } from './components/charts/metrics/MetricsSection';
import { MainLayout } from './components/layout/MainLayout';
import { Sidebar } from './components/layout/Sidebar';
import { LogPage } from './components/logs/LogPage';
import { SessionPanel } from './components/sessions/SessionPanel';
import { TopBar } from './components/topbar/TopBar';
import { AuthErrorScreen } from './components/ui/AuthErrorScreen';
import { ToastContainer } from './components/ui/Toast';
import { AuthErrorProvider, useAuthError } from './context/AuthErrorContext';
import { type Route, useHashRoute } from './hooks/useHashRoute';
import { useIsBelowMd } from './hooks/useIsBelowMd';
import { usePreference } from './hooks/usePreference';
import { I18nProvider } from './i18n/context';
import { client, setAuthErrorCallback } from './lib/urql-client';
import { ThemeProvider } from './theme/context';

const VALID_RANGES: MetricsRange[] = ['THIRTY_MIN', 'ONE_HOUR', 'SIX_HOUR', 'TWELVE_HOUR', 'TWENTY_FOUR_HOUR'];

function Dashboard({ navigate, route }: { navigate: (h: string) => void; route: Route }) {
  const urlRange = VALID_RANGES.includes(route.params.range as MetricsRange)
    ? (route.params.range as MetricsRange)
    : undefined;
  const [storedRange, setStoredRange] = usePreference<MetricsRange>('metrics-range', 'SIX_HOUR', {
    validate: (v) => VALID_RANGES.includes(v),
  });
  const range = urlRange ?? storedRange;
  const setRange = setStoredRange;
  const [sessionsReady, setSessionsReady] = useState(false);
  const [metricsReady, setMetricsReady] = useState(false);

  const onSessionsReady = useCallback(() => {
    setSessionsReady(true);
  }, []);
  const onMetricsReady = useCallback(() => {
    setMetricsReady(true);
  }, []);

  useEffect(() => {
    if (sessionsReady && metricsReady) {
      document.body.setAttribute('data-ready', 'true');
    }
    return () => {
      document.body.removeAttribute('data-ready');
    };
  }, [sessionsReady, metricsReady]);

  return (
    <MainLayout
      topBar={<TopBar currentPage="dashboard" onNavigate={navigate} metricsRange={range} />}
      sessions={<SessionPanel onReady={onSessionsReady} />}
      metrics={<MetricsSection range={range} onRangeChange={setRange} navigate={navigate} onReady={onMetricsReady} />}
    />
  );
}

function AppInner({ route, navigate }: { route: Route; navigate: (h: string) => void }) {
  const { authError, setAuthError } = useAuthError();
  const isMobile = useIsBelowMd();

  useEffect(() => {
    setAuthErrorCallback(() => {
      setAuthError(true);
    });
    return () => {
      setAuthErrorCallback(null);
    };
  }, [setAuthError]);

  if (authError) {
    return <AuthErrorScreen />;
  }

  const content =
    route.page === 'dashboard' ? (
      <Dashboard navigate={navigate} route={route} />
    ) : (
      <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <header
          className="backdrop-blur-sm sticky top-0 z-50 px-5 h-12 flex items-center flex-shrink-0"
          style={{
            borderBottom: '1px solid var(--border)',
            backgroundColor: 'var(--bg-surface-solid)',
            opacity: 0.97,
          }}
        >
          <TopBar currentPage="logs" onNavigate={navigate} metricsRange="TWENTY_FOUR_HOUR" />
        </header>
        <LogPage route={route} navigate={navigate} />
      </div>
    );

  if (!isMobile) {
    return (
      <div className="flex h-screen">
        <Sidebar currentPage={route.page} onNavigate={navigate} />
        <div className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">{content}</div>
      </div>
    );
  }

  // Mobile: no height-constrained parent, so wrap with min-h-screen
  // to ensure Logs page fills viewport (Dashboard's MainLayout already has h-screen)
  return <div className="min-h-screen">{content}</div>;
}

function App() {
  const { route, navigate } = useHashRoute();
  return (
    <ThemeProvider>
      <I18nProvider>
        <Provider value={client}>
          <AuthErrorProvider>
            <AppInner route={route} navigate={navigate} />
            <ToastContainer />
          </AuthErrorProvider>
        </Provider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
