// FILE: client/src/components/left-panel/AllEntityEntry.tsx
// PURPOSE: Pinned "All {Dimension}" entry above entity list — 4 visual states
// USED BY: client/src/components/left-panel/EntityList.tsx
// EXPORTS: AllEntityEntry

import { motion } from 'framer-motion';
import type { EntityListLoadState, DashboardPayload } from '@shared/types/dashboard';
import { formatInteger } from '@shared/utils/formatting';

interface AllEntityEntryProps {
  label: string;
  loadState: EntityListLoadState;
  isActive: boolean;
  aggregateData: DashboardPayload | null;
  entitiesWithOrders: number;
  onClick: () => void;
  onRefresh: () => void;
}

function formatLargeNumber(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${formatInteger(value)}`;
}

export function AllEntityEntry({
  label, loadState, isActive, aggregateData,
  entitiesWithOrders, onClick, onRefresh,
}: AllEntityEntryProps) {
  const isLoaded = loadState === 'loaded';
  const isLoading = loadState === 'loading';

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
    >
      {isActive && (
        <div className="absolute left-0 top-0 h-full w-[3px] rounded-r-[2px] bg-[var(--color-gold-primary)]" />
      )}

      {/* Bar chart icon */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg} ${isLoading ? 'animate-pulse' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1" y="8" width="3" height="7" rx="0.5" fill="currentColor" />
          <rect x="6" y="4" width="3" height="11" rx="0.5" fill="currentColor" />
          <rect x="11" y="1" width="3" height="14" rx="0.5" fill="currentColor" />
        </svg>
      </div>

      {/* Text */}
      <div className="flex-1">
        <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">{label}</div>
        <div className="text-[11px] text-[var(--color-text-muted)]">
          {isLoaded
            ? `${formatInteger(entitiesWithOrders)} with orders`
            : isLoading
              ? 'Generating...'
              : 'Click to generate report'}
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-[var(--spacing-sm)]">
        {isLoaded && aggregateData ? (
          <div className="text-right">
            <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">
              {formatLargeNumber(aggregateData.kpis.totalRevenue)}
            </div>
            <div className="text-[11px] text-[var(--color-text-muted)]">
              {formatInteger(aggregateData.kpis.orders)} orders
            </div>
          </div>
        ) : isLoading ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-gold-primary)] border-t-transparent" />
        ) : (
          <span className="rounded-full bg-[var(--color-gold-subtle)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-gold-primary)]">
            Not loaded
          </span>
        )}

        {/* Refresh button — only when loaded */}
        {isLoaded && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onRefresh(); }}
            title="Refresh data (force full re-fetch)"
            className="flex h-7 w-7 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-gold-subtle)] hover:text-[var(--color-gold-primary)]"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M13.65 2.35A8 8 0 1 0 16 8h-2a6 6 0 1 1-1.76-4.24L10 6h6V0l-2.35 2.35z" fill="currentColor" />
            </svg>
          </button>
        )}
      </div>
    </motion.div>
  );
}
