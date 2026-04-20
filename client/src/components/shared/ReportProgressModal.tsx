// FILE: client/src/components/shared/ReportProgressModal.tsx
// PURPOSE: Two-phase progress modal during Report SSE fetch + error state with Close/Retry.
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: ReportProgressModal

import { useState, useEffect } from 'react';
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
  // WHY: SSEProgressEvent is a union — 'rowsFetched' only exists on fetching/incremental
  const rows = progress && 'rowsFetched' in progress ? progress.rowsFetched : 0;
  const message = progress && 'message' in progress ? progress.message : undefined;

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
  rows: number;
  message: string | undefined;
  onCancel: () => void;
}

function ProgressContent({ inPhase1, inPhase2, rows, message, onCancel }: ProgressContentProps) {
  // WHY: Elapsed timer ticks every second — visual "alive" signal during long Priority fetches.
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const elapsedText = mins > 0
    ? `${mins}m ${secs.toString().padStart(2, '0')}s`
    : `${secs}s`;

  // WHY: "Connecting to Priority ERP…" before first page arrives (30-90s) tells user the app
  // is working, not frozen. Switches to "X rows received" once data starts flowing.
  const phase1Detail = inPhase1
    ? (rows > 0 ? `${formatInteger(rows)} rows received` : 'Connecting to Priority ERP\u2026')
    : (rows > 0 ? `${formatInteger(rows)} rows fetched` : 'Loaded from cache');

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
        indeterminate={inPhase1}
        percent={inPhase2 ? 100 : 0}
        detail={phase1Detail}
        detailRight={inPhase1 ? elapsedText : ''}
      />

      <PhaseBlock
        title="Phase 2 — Computing metrics"
        active={inPhase2}
        done={false}
        indeterminate={inPhase2}
        percent={0}
        detail={inPhase2 ? (message ?? 'Processing\u2026') : 'Waiting\u2026'}
        detailRight={inPhase2 ? elapsedText : ''}
      />

      <p className="text-center text-[11px] text-[var(--color-text-faint)]">
        This usually takes 10&ndash;15 minutes
      </p>

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
        <p className="max-h-[120px] overflow-auto rounded-[var(--radius-base)] bg-[var(--color-gold-subtle)] p-[var(--spacing-md)] text-center text-[12px] text-[var(--color-red)]">
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
  indeterminate?: boolean;
  percent: number;
  detail: string;
  detailRight: string;
}

function PhaseBlock({ title, active, done, indeterminate, percent, detail, detailRight }: PhaseBlockProps) {
  const color = active
    ? 'var(--color-gold-primary)'
    : done
      ? 'var(--color-green)'
      : 'var(--color-text-faint)';

  return (
    <div className="flex flex-col gap-[var(--spacing-sm)] border-t border-[var(--color-gold-subtle)] pt-[var(--spacing-lg)] first:border-t-0 first:pt-0">
      <h3 className="text-[13px] font-semibold" style={{ color }}>{title}</h3>
      <div className="h-[4px] overflow-hidden rounded-full bg-[var(--color-gold-subtle)]">
        {/* WHY: Indeterminate shimmer (gold bar sliding L→R in 1.5s loop) provides constant
         * visual motion so the user knows the app is alive during long Priority API waits.
         * Determinate bar used only for completed phases (100% green). */}
        {indeterminate ? (
          <motion.div
            className="h-full w-[40%] rounded-full"
            style={{ background: color }}
            animate={{ x: ['-100%', '250%'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          />
        ) : (
          <motion.div
            className="h-full rounded-full"
            style={{ background: color }}
            animate={{ width: `${percent}%` }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          />
        )}
      </div>
      <div className="flex items-center justify-between text-[11px] text-[var(--color-text-muted)]">
        <span>{detail}</span>
        <span>{detailRight}</span>
      </div>
    </div>
  );
}
