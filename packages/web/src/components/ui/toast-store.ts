export type ToastType = 'error' | 'success' | 'loading';

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

export type ToastAction =
  | { kind: 'add'; msg: ToastMessage }
  | { kind: 'dismiss'; id: number }
  | { kind: 'replace'; id: number; msg: ToastMessage };

let nextId = 0;
const listeners = new Set<(action: ToastAction) => void>();

/** Show a toast. Returns the toast id (useful for dismiss/replace). */
export function showToast(text: string, type: ToastType = 'error'): number {
  const id = ++nextId;
  const msg: ToastMessage = { id, text, type };
  for (const fn of listeners) {
    fn({ kind: 'add', msg });
  }
  return id;
}

/** Dismiss a toast by id. */
export function dismissToast(id: number): void {
  for (const fn of listeners) {
    fn({ kind: 'dismiss', id });
  }
}

/** Replace a toast (update text/type in-place). */
export function replaceToast(id: number, text: string, type: ToastType = 'success'): void {
  const msg: ToastMessage = { id, text, type };
  for (const fn of listeners) {
    fn({ kind: 'replace', id, msg });
  }
}

export function subscribe(fn: (action: ToastAction) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
