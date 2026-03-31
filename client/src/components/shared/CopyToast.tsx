// FILE: client/src/components/shared/CopyToast.tsx
// PURPOSE: Shared toast context for click-to-copy feedback — single toast, auto-dismiss
// USED BY: client/src/App.tsx (provider), client/src/components/shared/CopyableId.tsx (consumer)
// EXPORTS: CopyToastProvider, useCopyToast

import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CopyToastContextValue {
  showToast: (text: string) => void;
}

const CopyToastContext = createContext<CopyToastContextValue | null>(null);

export function useCopyToast() {
  const ctx = useContext(CopyToastContext);
  if (!ctx) throw new Error('useCopyToast must be used inside CopyToastProvider');
  return ctx;
}

export function CopyToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showToast = useCallback((text: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setMessage(text);
    timerRef.current = setTimeout(() => setMessage(null), 1500);
  }, []);

  return (
    <CopyToastContext value={{ showToast }}>
      {children}
      <AnimatePresence>
        {message && (
          <motion.div
            key="copy-toast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.15 }}
            className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-[var(--radius-xl)] bg-[var(--color-dark)] px-[var(--spacing-2xl)] py-[var(--spacing-md)] text-[12px] font-medium text-white shadow-lg"
            role="status"
            aria-live="polite"
          >
            {message}
          </motion.div>
        )}
      </AnimatePresence>
    </CopyToastContext>
  );
}
