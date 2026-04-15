// FILE: client/src/components/left-panel/ReportButton.tsx
// PURPOSE: "Report" entry pinned above the entity list — opens the report filter/fetch flow
// USED BY: client/src/components/left-panel/EntityList.tsx
// EXPORTS: ReportButton

import { motion } from 'framer-motion';
import type { ReportState } from '../../hooks/useReport';
import type { CacheStatus, DashboardPayload } from '@shared/types/dashboard';
import { formatInteger } from '@shared/utils/formatting';

interface ReportButtonProps {
  state: ReportState;
  payload: DashboardPayload | null;
  cacheStatus: CacheStatus | undefined;
  isActive: boolean;
  onClick: () => void;
}

function formatLargeNumber(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${formatInteger(value)}`;
}

export function ReportButton({ state, payload, cacheStatus, isActive, onClick }: ReportButtonProps) {
  const isLoading = state === 'fetching';
  const isLoaded = state === 'loaded' && payload !== null;
  const serverCached = cacheStatus?.raw === true;

  const iconBg = isActive
    ? 'bg-[var(--color-gold-primary)] text-white'
    : 'bg-[var(--color-gold-subtle)] text-[var(--color-gold-primary)]';

  return (
    <motion.div
      onClick={isLoading ? undefined : onClick}
      whileHover={isLoading ? undefined : { scale: 1.005 }}
      className={`
        relative flex cursor-pointer items-center gap-[var(--spacing-md)]
        border-b-2 border-[var(--color-gold-subtle)]
        px-[var(--spacing-2xl)] py-[var(--spacing-lg)]
        ${isActive ? 'bg-[var(--color-gold-hover)]' : 'bg-transparent hover:bg-[var(--color-gold-hover)]'}
        ${isLoading ? 'cursor-wait' : ''}
      `}
      role="button"
      tabIndex={0}
      aria-label="Report"
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !isLoading) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {isActive && (
        <div className="absolute left-0 top-0 h-full w-[3px] rounded-r-[2px] bg-[var(--color-gold-primary)]" />
      )}

      {/* Gold clipboard-with-arrow icon */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg} ${isLoading ? 'animate-pulse' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M5 2h6v2H5V2zm-1 3h8v9H4V5zm2 2v2h4V7H6zm0 3v2h4v-2H6z" fill="currentColor" />
        </svg>
      </div>

      <div className="flex-1">
        <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">Report</div>
        <div className="text-[11px] text-[var(--color-text-muted)]">
          {isLoaded
            ? 'Loaded this session'
            : isLoading
              ? 'Generating...'
              : serverCached
                ? 'Data ready — click to view'
                : 'Click to generate report'}
        </div>
      </div>

      <div className="flex items-center gap-[var(--spacing-sm)]">
        {isLoaded && payload ? (
          <div className="text-right">
            <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">
              {formatLargeNumber(payload.kpis.totalRevenue)}
            </div>
            <div className="text-[11px] text-[var(--color-text-muted)]">
              {formatInteger(payload.kpis.orders)} orders
            </div>
          </div>
        ) : isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-gold-primary)] border-t-transparent" />
        ) : serverCached && cacheStatus?.rowCount ? (
          <span className="rounded-full bg-[var(--color-gold-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-gold-primary)]">
            {formatInteger(cacheStatus.rowCount)} rows
          </span>
        ) : (
          <span className="rounded-full bg-[var(--color-gold-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-gold-primary)]">
            Not loaded
          </span>
        )}
      </div>
    </motion.div>
  );
}
