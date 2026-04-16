// FILE: client/src/components/shared/ReportProgressModal.tsx
// PURPOSE: Two-phase progress modal during Report SSE fetch + error state with Close/Retry.
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: ReportProgressModal

import { AnimatePresence, motion } from 'framer-motion';
import type { SSEProgressEvent } from '@shared/types/dashboard';
import { formatInteger } from '@shared/utils/formatting';

interface ReportProgressModalProps {
  isOpen: boolean;
  progress: SSEProgressEvent | null;
  errorMessage: string | null;
  onCancel: () => void;
  onClose: () => void;
  onRetry: () => void;
}

export function ReportProgressModal({
  isOpen, progress, errorMessage, onCancel, onClose, onRetry,
}: ReportProgressModalProps) {
  const isError = errorMessage !== null;
  const phase = progress?.phase ?? 'fetching';
  // WHY: SSEProgressEvent is a union — 'rowsFetched'/'estimatedTotal' only exist on fetching/incremental
  const rows = progress && 'rowsFetched' in progress ? progress.rowsFetched : 0;
  const total = progress && 'estimatedTotal' in progress ? progress.estimatedTotal : 0;
  const message = progress && 'message' in progress ? progress.message : undefined;
  const percent = total > 0 ? Math.min(100, Math.round((rows / total) * 100)) : 0;

  const inPhase1 = phase === 'fetching' || phase === 'incremental';
  const inPhase2 = phase === 'processing' || phase === 'merging';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="flex w-[460px] max-w-[90vw] flex-col gap-[var(--spacing-2xl)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-[var(--spacing-3xl)] shadow-[var(--shadow-card)]"
            role="dialog"
            aria-live="polite"
            aria-label={isError ? 'Building report error' : 'Building report progress'}
          >
            {isError ? (
              <ErrorContent message={errorMessage} onClose={onClose} onRetry={onRetry} />
            ) : (
              <ProgressContent
                inPhase1={inPhase1}
                inPhase2={inPhase2}
                percent={percent}
                rows={rows}
                message={message}
                onCancel={onCancel}
              />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ProgressContentProps {
  inPhase1: boolean;
  inPhase2: boolean;
  percent: number;
  rows: number;
  message: string | undefined;
  onCancel: () => void;
}

function ProgressContent({ inPhase1, inPhase2, percent, rows, message, onCancel }: ProgressContentProps) {
  return (
    <>
      <div>
        <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Building Report</h2>
        <p className="mt-[var(--spacing-xs)] text-[12px] text-[var(--color-text-muted)]">
          Fetching order data from Priority ERP&hellip;
        </p>
      </div>

      <PhaseBlock
        title="Phase 1 of 2 — Fetching orders"
        active={inPhase1}
        done={inPhase2}
        percent={inPhase1 ? percent : 100}
        detail={inPhase1 ? `${formatInteger(rows)} rows` : 'Complete'}
        detailRight={inPhase1 ? `${percent}%` : '100%'}
      />

      <PhaseBlock
        title="Phase 2 — Computing metrics"
        active={inPhase2}
        done={false}
        percent={inPhase2 ? 50 : 0}
        detail={inPhase2 ? (message ?? 'Processing...') : 'Waiting...'}
        detailRight=""
      />

      {inPhase1 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="text-[13px] text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            Cancel
          </button>
        </div>
      )}
    </>
  );
}

interface ErrorContentProps {
  message: string;
  onClose: () => void;
  onRetry: () => void;
}

function ErrorContent({ message, onClose, onRetry }: ErrorContentProps) {
  return (
    <>
      <div className="flex flex-col items-center gap-[var(--spacing-md)]">
        <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)]">Something went wrong</h2>
        <p className="rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] p-[var(--spacing-md)] text-center text-[12px] text-[var(--color-red)]">
          {message}
        </p>
      </div>
      <div className="flex gap-[var(--spacing-md)]">
        <button
          type="button"
          data-action="close"
          onClick={onClose}
          className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-gold-muted)]"
        >
          Close
        </button>
        <button
          type="button"
          data-action="retry"
          onClick={onRetry}
          className="flex-1 rounded-[var(--radius-base)] bg-[var(--color-dark)] px-[var(--spacing-2xl)] py-[var(--spacing-lg)] text-[13px] font-medium text-white hover:bg-[var(--color-dark-hover)]"
        >
          Retry
        </button>
      </div>
    </>
  );
}

interface PhaseBlockProps {
  title: string;
  active: boolean;
  done: boolean;
  percent: number;
  detail: string;
  detailRight: string;
}

function PhaseBlock({ title, active, done, percent, detail, detailRight }: PhaseBlockProps) {
  const color = active
    ? 'var(--color-gold-primary)'
    : done
      ? 'var(--color-green)'
      : 'var(--color-text-faint)';

  return (
    <div className="flex flex-col gap-[var(--spacing-sm)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)] first:border-t-0 first:pt-0">
      <h3 className="text-[13px] font-semibold" style={{ color }}>{title}</h3>
      <div className="h-[4px] overflow-hidden rounded-full bg-[var(--color-gold-subtle)]">
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
        <span>{detail}</span>
        <span>{detailRight}</span>
      </div>
    </div>
  );
}
