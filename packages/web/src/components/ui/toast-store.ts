export interface ToastMessage {
  id: number;
  text: string;
  type: 'error' | 'success';
}

let nextId = 0;
const listeners = new Set<(msg: ToastMessage) => void>();

export function showToast(text: string, type: 'error' | 'success' = 'error'): void {
  const msg: ToastMessage = { id: ++nextId, text, type };
  for (const fn of listeners) {
    fn(msg);
  }
}

export function subscribe(fn: (msg: ToastMessage) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
