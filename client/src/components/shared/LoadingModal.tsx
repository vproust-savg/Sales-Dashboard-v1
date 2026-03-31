// FILE: client/src/components/shared/LoadingModal.tsx
// PURPOSE: Centered modal overlay showing loading progress while data loads from Priority
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: LoadingModal

import { motion, AnimatePresence } from 'framer-motion';

interface LoadingModalProps {
  stage: string | null;
}

export function LoadingModal({ stage }: LoadingModalProps) {
  return (
    <AnimatePresence>
      {stage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"
          role="dialog"
          aria-label="Loading"
          aria-live="polite"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col items-center gap-[var(--spacing-xl)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] px-[var(--spacing-4xl)] py-[var(--spacing-3xl)] shadow-[var(--shadow-card)]"
          >
            {/* Spinning ring with gold accent */}
            <div className="h-10 w-10 animate-spin rounded-full border-3 border-[var(--color-gold-subtle)] border-t-[var(--color-gold-primary)]" />
            <p className="text-[14px] font-medium text-[var(--color-text-primary)]">{stage}</p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
