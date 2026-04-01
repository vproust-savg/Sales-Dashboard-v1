// FILE: client/src/components/right-panel/FetchAllProgress.tsx
// PURPOSE: Progress card replacing right panel during SSE fetch
// USED BY: client/src/layouts/DashboardLayout.tsx
// EXPORTS: FetchAllProgress

import type { SSEProgressEvent } from '@shared/types/dashboard';

interface FetchAllProgressProps {
  progress: SSEProgressEvent | null;
}

export function FetchAllProgress({ progress }: FetchAllProgressProps) {
  const phase = progress?.phase ?? 'fetching';
  const isFetching = phase === 'fetching' || phase === 'incremental';
  const rowsFetched = progress && 'rowsFetched' in progress ? progress.rowsFetched : 0;
  const estimatedTotal = progress && 'estimatedTotal' in progress ? progress.estimatedTotal : 0;
  const percent = estimatedTotal > 0 ? Math.min(100, Math.round((rowsFetched / estimatedTotal) * 100)) : 0;

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="w-[400px] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] p-8 shadow-[var(--shadow-card)]">
        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">
          Loading All Data
        </h3>
        <p className="mb-4 text-[12px] text-[var(--color-text-muted)]">
          Fetching order data from Priority ERP...
        </p>

        {/* Phase 1 */}
        <p className="mb-3 text-[12px] font-medium text-[var(--color-gold-primary)]">
          Phase 1 of 2 &mdash; {phase === 'incremental' ? 'Fetching new orders' : 'Fetching orders'}
        </p>
        <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-gold-subtle)]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[var(--color-gold-primary)] to-[var(--color-gold-light)] transition-all duration-300"
            style={{ width: `${isFetching ? percent : 100}%` }}
          />
        </div>
        <div className="mb-4 flex justify-between text-[11px] text-[var(--color-text-muted)]">
          <span>{rowsFetched.toLocaleString()} {estimatedTotal > 0 ? `of ~${estimatedTotal.toLocaleString()} rows` : 'rows'}</span>
          {isFetching && <span>{percent}%</span>}
        </div>

        {/* Phase 2 */}
        <div className="border-t border-[var(--color-gold-subtle)] pt-3">
          <p className={`text-[12px] font-medium ${phase === 'processing' || phase === 'merging' ? 'text-[var(--color-gold-primary)]' : 'text-[var(--color-text-muted)]'}`}>
            Phase 2 &mdash; Computing metrics
          </p>
          {(phase === 'processing' || phase === 'merging') && progress && 'message' in progress && (
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">{progress.message}</p>
          )}
          {isFetching && (
            <p className="mt-1 text-[11px] text-[var(--color-text-muted)]">Waiting...</p>
          )}
        </div>
      </div>
    </div>
  );
}
