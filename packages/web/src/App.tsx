import { Provider } from 'urql';
import { client } from './lib/urql-client';
import { MainLayout } from './components/layout/MainLayout';
import { TopBar } from './components/topbar/TopBar';
import { SessionPanel } from './components/sessions/SessionPanel';
import { MetricsSection } from './components/charts/MetricsSection';
import { LogPanel } from './components/logs/LogPanel';
import { useOperationModals, RestartModal, UpdateModal, DoctorModal } from './components/modals/OperationModals';

function Dashboard() {
  const { modal, open, close } = useOperationModals();

  return (
    <>
      <MainLayout
        topBar={<TopBar onAction={open} />}
        sessions={<SessionPanel />}
        metrics={<MetricsSection />}
        logs={<LogPanel />}
      />
      {modal === 'restart' && <RestartModal onClose={close} />}
      {modal === 'update' && <UpdateModal onClose={close} />}
      {modal === 'doctor' && <DoctorModal onClose={close} />}
    </>
  );
}

function App() {
  return (
    <Provider value={client}>
      <Dashboard />
    </Provider>
  );
}

export default App;
