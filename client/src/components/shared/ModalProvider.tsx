// FILE: client/src/components/shared/ModalProvider.tsx
// PURPOSE: React context for opening/closing card expansion modals
// USED BY: App.tsx (provider), any card (consumer via useModal), CardModal (renders content)
// EXPORTS: ModalProvider, useModal

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { CardModal } from './CardModal';

interface ModalContextValue {
  openModal: (title: string, content: ReactNode, headerActions?: ReactNode) => void;
  closeModal: () => void;
  /** WHY: lets a long-lived modal body update the header toolbar (Top-N selector,
   *  Export button) as its internal state changes — without re-mounting the body. */
  setHeaderActions: (actions: ReactNode | null) => void;
}

const ModalContext = createContext<ModalContextValue | null>(null);

export function useModal(): ModalContextValue {
  const ctx = useContext(ModalContext);
  if (!ctx) throw new Error('useModal must be used within ModalProvider');
  return ctx;
}

interface ModalState {
  title: string;
  content: ReactNode;
  headerActions: ReactNode | null;
}

export function ModalProvider({ children }: { children: ReactNode }) {
  const [modal, setModal] = useState<ModalState | null>(null);

  const openModal = useCallback((title: string, content: ReactNode, headerActions: ReactNode = null) => {
    setModal({ title, content, headerActions });
  }, []);

  const closeModal = useCallback(() => setModal(null), []);

  const setHeaderActions = useCallback((actions: ReactNode | null) => {
    setModal(prev => prev ? { ...prev, headerActions: actions } : prev);
  }, []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal, setHeaderActions }}>
      {children}
      <CardModal
        isOpen={modal !== null}
        title={modal?.title ?? ''}
        onClose={closeModal}
        headerActions={modal?.headerActions ?? undefined}
      >
        {modal?.content}
      </CardModal>
    </ModalContext.Provider>
  );
}
