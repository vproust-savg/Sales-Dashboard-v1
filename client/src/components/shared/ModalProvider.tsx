// FILE: client/src/components/shared/ModalProvider.tsx
// PURPOSE: React context for opening/closing card expansion modals
// USED BY: App.tsx (provider), any card (consumer via useModal), CardModal (renders content)
// EXPORTS: ModalProvider, useModal

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CardModal } from './CardModal';

interface ModalContextValue {
  openModal: (title: string, content: ReactNode) => void;
  closeModal: () => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<{ title: string; content: ReactNode } | null>(null);

  const openModal = useCallback((title: string, content: ReactNode) => {
    setModal({ title, content });
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      <CardModal isOpen={modal !== null} title={modal?.title ?? ''} onClose={closeModal}>
        {modal?.content}
      </CardModal>
    </ModalContext.Provider>
  );
}
