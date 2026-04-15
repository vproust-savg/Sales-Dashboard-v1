// FILE: client/src/components/left-panel/ReportButton.tsx
// PURPOSE: "Report" entry pinned above the entity list — opens the report filter/fetch flow
// USED BY: client/src/components/left-panel/EntityList.tsx
// EXPORTS: ReportButton

import { motion } from 'framer-motion';
import type { ReportState } from '../../hooks/useReport';

interface ReportButtonProps {
  state: ReportState;
  isActive: boolean;
  onClick: () => void;
}

export function ReportButton({ state, isActive, onClick }: ReportButtonProps) {
  const isLoading = state === 'fetching';

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

      {/* Gold 3-bar ascending bar chart icon */}
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconBg} ${isLoading ? 'animate-pulse' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1" y="9" width="4" height="6" rx="0.5" fill="currentColor"/>
          <rect x="6" y="5" width="4" height="10" rx="0.5" fill="currentColor"/>
          <rect x="11" y="1" width="4" height="14" rx="0.5" fill="currentColor"/>
        </svg>
      </div>

      <div className="flex-1">
        <div className="text-[14px] font-semibold text-[var(--color-text-primary)]">Report</div>
      </div>
    </motion.div>
  );
}
