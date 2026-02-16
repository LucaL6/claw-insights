import { useState } from 'react';
import { Provider } from 'urql';
import { client } from './lib/urql-client';
import { MainLayout } from './components/layout/MainLayout';
import { TopBar } from './components/topbar/TopBar';
import { SessionPanel } from './components/sessions/SessionPanel';
import { MetricsSection } from './components/charts/MetricsSection';
import { useOperationModals, RestartModal, UpdateModal, DoctorModal } from './components/modals/OperationModals';
import type { MetricsRange } from './components/charts/GranularityPicker';

function Dashboard() {
  const { modal, open, close } = useOperationModals();
  const [range, setRange] = useState<MetricsRange>('TWENTY_FOUR_HOUR');

  return (
    <>
      <MainLayout
        topBar={<TopBar onAction={open} metricsRange={range} />}
        sessions={<SessionPanel />}
        metrics={<MetricsSection range={range} onRangeChange={setRange} />}
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
