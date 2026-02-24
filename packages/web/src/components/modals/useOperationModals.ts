import { useState } from 'react';

interface ModalState {
  type: 'restart' | 'doctor' | 'update' | null;
}

export function useOperationModals() {
  const [modal, setModal] = useState<ModalState>({ type: null });
  const [result, setResult] = useState<{ success: boolean; output: string } | null>(null);

  const open = (type: 'restart' | 'doctor' | 'update') => {
    setResult(null);
    setModal({ type });
  };
  const close = () => { setModal({ type: null }); };

  return { modal: modal.type, open, close, result, setResult };
}
