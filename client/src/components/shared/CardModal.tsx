// FILE: client/src/components/shared/CardModal.tsx
// PURPOSE: Modal overlay — backdrop blur, centered panel, close on Escape/backdrop, animation
// USED BY: ModalProvider.tsx
// EXPORTS: CardModal

import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

interface CardModalProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** WHY: optional toolbar slot rendered between title and close button.
   *  Used by Best Sellers modal for the Top-N selector + Export button. */
  headerActions?: ReactNode;
}

export function CardModal({ isOpen, title, onClose, children, headerActions }: CardModalProps) {
  /** WHY: Escape key closes modal — standard accessibility pattern */
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  /** WHY: Prevent body scroll when modal is open */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [isOpen]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-[var(--spacing-4xl)]"
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-[4px]" onClick={onClose} aria-hidden="true" />

          {/* Panel */}
          <motion.div
            initial={{ scale: 0.96, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="relative z-10 max-h-[85vh] w-[90vw] max-w-[640px] overflow-y-auto rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-4xl)] shadow-[var(--shadow-dropdown)]"
          >
            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-[var(--spacing-2xl)] top-[var(--spacing-2xl)] flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-base)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-gold-subtle)] hover:text-[var(--color-text-primary)]"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>

            {/* Header row: title + optional actions. Reserves right padding for the close button. */}
            {(title || headerActions) && (
              <div className="mb-[var(--spacing-2xl)] flex items-center justify-between gap-[var(--spacing-2xl)] pr-12">
                {title ? (
                  <h2 className="text-[14px] font-semibold uppercase tracking-[0.5px] text-[var(--color-text-muted)]">
                    {title}
                  </h2>
                ) : (
                  <div />
                )}
                {headerActions && (
                  <div className="flex items-center gap-[var(--spacing-md)]">
                    {headerActions}
                  </div>
                )}
              </div>
            )}

            {/* Content */}
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
