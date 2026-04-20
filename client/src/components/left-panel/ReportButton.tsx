// FILE: client/src/components/left-panel/ReportButton.tsx
// PURPOSE: Primary "Report" CTA pinned at the top of the left panel — opens the report filter/fetch flow
// USED BY: client/src/components/left-panel/LeftPanel.tsx
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

  return (
    <motion.button
      type="button"
      disabled={isLoading}
      onClick={onClick}
      whileHover={isLoading ? undefined : { scale: 1.005 }}
      aria-label="Report"
      aria-pressed={isActive}
      className={`
        flex w-full cursor-pointer items-center gap-[var(--spacing-md)]
        rounded-[var(--radius-2xl)]
        bg-[var(--color-gold-primary)]
        px-[var(--spacing-2xl)] py-[var(--spacing-lg)]
        text-[var(--color-text-primary)]
        shadow-[var(--shadow-card)]
        transition-shadow
        ${isActive ? 'shadow-inner' : 'hover:shadow-[var(--shadow-glow)]'}
        ${isLoading ? 'cursor-wait' : ''}
      `}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/35 ${isLoading ? 'animate-pulse' : ''}`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="1" y="9" width="4" height="6" rx="0.5" fill="currentColor" />
          <rect x="6" y="5" width="4" height="10" rx="0.5" fill="currentColor" />
          <rect x="11" y="1" width="4" height="14" rx="0.5" fill="currentColor" />
        </svg>
      </span>
      <span className="flex-1 text-left text-[14px] font-semibold">Report</span>
    </motion.button>
  );
}
