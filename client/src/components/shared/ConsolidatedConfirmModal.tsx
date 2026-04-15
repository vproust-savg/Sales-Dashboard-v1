// FILE: client/src/components/shared/ConsolidatedConfirmModal.tsx
// PURPOSE: Confirmation modal + inline progress for View Consolidated
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: ConsolidatedConfirmModal

import { AnimatePresence, motion } from 'framer-motion';
import type { ConsolidatedState } from '../../hooks/useConsolidated';
import type { EntityListItem } from '@shared/types/dashboard';

interface ConsolidatedConfirmModalProps {
  isOpen: boolean;
  state: ConsolidatedState;
  selectedEntities: EntityListItem[];
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  onGoToReport: () => void;
}

export function ConsolidatedConfirmModal({
  isOpen, state, selectedEntities, error, onConfirm, onCancel, onGoToReport,
}: ConsolidatedConfirmModalProps) {
  const count = selectedEntities.length;
  const isFetching = state === 'fetching';
  const needsReport = state === 'needs-report';
  const hasError = state === 'error';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          onClick={isFetching ? undefined : onCancel}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="flex w-[420px] max-w-[90vw] flex-col gap-[var(--spacing-2xl)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]"
            role="dialog"
            aria-label="Confirm View Consolidated"
          >
            <div className="flex flex-col items-center gap-[var(--spacing-md)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--color-gold-subtle)]">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                  <rect x="3" y="3" width="14" height="14" rx="3" stroke="var(--color-gold-primary)" strokeWidth="1.5" />
                  <path d="M6 10l3 3 5-6" stroke="var(--color-gold-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">
                {needsReport ? 'Data not available' : hasError ? 'Something went wrong' : 'Confirm View Consolidated'}
              </h2>
            </div>

            {!needsReport && !hasError && (
              <>
                <p className="text-center text-[13px] text-[var(--color-text-secondary)]">
                  Fetching data for <strong>{count}</strong> selected {count === 1 ? 'entity' : 'entities'}
                </p>

                <div className="max-h-[160px] overflow-y-auto rounded-[var(--radius-base)] border border-[var(--color-gold-muted)] bg-[var(--color-bg-page)] p-[var(--spacing-md)]">
                  <ul className="flex flex-col gap-[var(--spacing-xs)]">
                    {selectedEntities.map(e => (
                      <li key={e.id} className="text-[12px] text-[var(--color-text-secondary)]">
                        {e.name}
                      </li>
                    ))}
                  </ul>
                </div>

                {isFetching && (
                  <div className="flex items-center justify-center gap-[var(--spacing-sm)] text-[12px] text-[var(--color-text-muted)]">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-gold-primary)] border-t-transparent" />
                    <span>Loading&hellip;</span>
                  </div>
                )}

                <div className="flex gap-[var(--spacing-md)]">
                  <button
                    type="button"
                    onClick={onCancel}
                    disabled={isFetching}
                    className={`flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-[var(--color-text-secondary)] transition-colors ${isFetching ? 'cursor-not-allowed opacity-50' : 'hover:bg-[var(--color-gold-muted)]'}`}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={isFetching}
                    className={`flex-1 rounded-[var(--radius-base)] bg-[var(--color-dark)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-white transition-colors ${isFetching ? 'cursor-not-allowed opacity-70' : 'hover:bg-[var(--color-dark-hover)]'}`}
                  >
                    Start
                  </button>
                </div>
              </>
            )}

            {needsReport && (
              <>
                <p className="text-center text-[13px] text-[var(--color-text-secondary)]">
                  This requires running Report first to load data from Priority ERP.
                </p>
                <div className="flex gap-[var(--spacing-md)]">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-gold-muted)]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={onGoToReport}
                    className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-primary)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-white hover:bg-[var(--color-gold-hover)]"
                  >
                    Go to Report
                  </button>
                </div>
              </>
            )}

            {hasError && error && (
              <>
                <p className="rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] p-[var(--spacing-md)] text-center text-[12px] text-[var(--color-red)]">
                  {error}
                </p>
                <div className="flex gap-[var(--spacing-md)]">
                  <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-gold-muted)]"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-dark)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-white hover:bg-[var(--color-dark-hover)]"
                  >
                    Retry
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
