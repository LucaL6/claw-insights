import { useSyncExternalStore } from 'react';

import { connectionHealth } from '../lib/connection-health';

export type DashboardConnection = 'connected' | 'reconnecting' | 'connecting';

const subscribe = (cb: () => void) => connectionHealth.subscribe(cb);
const getSnapshot = () => connectionHealth.getSnapshot();

export function useConnectionStatus(): DashboardConnection {
  const snap = useSyncExternalStore(subscribe, getSnapshot);

  if (!snap.everConnected) {
    return 'connecting';
  }
  if (snap.isOffline) {
    return 'reconnecting';
  }
  return 'connected';
}
