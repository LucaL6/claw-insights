import { useCallback, useEffect, useState } from 'react';
import { Provider } from 'urql';

import type { MetricsRange } from './components/charts/metrics/GranularityPicker';
import { MetricsSection } from './components/charts/metrics/MetricsSection';
import { GatewayBanner } from './components/gateway/GatewayBanner';
import { MainLayout } from './components/layout/MainLayout';
import { LogPage } from './components/logs/LogPage';
import { SessionPanel } from './components/sessions/SessionPanel';
import { TopBar } from './components/topbar/TopBar';
import { AuthErrorScreen } from './components/ui/AuthErrorScreen';
import { AuthErrorProvider, useAuthError } from './context/AuthErrorContext';
import { type Route, useHashRoute } from './hooks/useHashRoute';
import { usePreference } from './hooks/usePreference';
import { I18nProvider } from './i18n/context';
import { client, setAuthErrorCallback } from './lib/urql-client';
import { ThemeProvider } from './theme/context';

const VALID_RANGES: MetricsRange[] = ['ONE_HOUR', 'SIX_HOUR', 'TWELVE_HOUR', 'TWENTY_FOUR_HOUR'];

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
      banner={<GatewayBanner />}
      sessions={<SessionPanel onReady={onSessionsReady} />}
      metrics={<MetricsSection range={range} onRangeChange={setRange} navigate={navigate} onReady={onMetricsReady} />}
    />
  );
}

function AppInner({ route, navigate }: { route: Route; navigate: (h: string) => void }) {
  const { authError, setAuthError } = useAuthError();

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

  return (
    <Provider value={client}>
      {route.page === 'dashboard' ? (
        <Dashboard navigate={navigate} route={route} />
      ) : (
        <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
          <header
            className="backdrop-blur-sm sticky top-0 z-50 px-5 py-2"
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
      )}
    </Provider>
  );
}

function App() {
  const { route, navigate } = useHashRoute();
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthErrorProvider>
          <AppInner route={route} navigate={navigate} />
        </AuthErrorProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}

export default App;
