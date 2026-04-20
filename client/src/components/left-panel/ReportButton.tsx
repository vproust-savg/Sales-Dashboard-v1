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
        flex h-[44px] w-full cursor-pointer items-center justify-start
        gap-[var(--spacing-md)]
        rounded-[var(--radius-lg)]
        px-[var(--spacing-2xl)]
        text-[15px] font-semibold tracking-[-0.01em]
        shadow-[var(--shadow-card)]
        transition-[box-shadow,background-color] duration-150
        ${isActive
          ? 'bg-[var(--color-dark)] text-white hover:bg-[var(--color-dark-hover)]'
          : 'bg-[var(--color-gold-primary)] text-[var(--color-text-primary)] hover:shadow-[var(--shadow-glow)]'
        }
        ${isLoading ? 'animate-pulse cursor-wait' : ''}
      `}
    >
      {/* 3-bar ascending bar chart — inherits currentColor so it flips with active state */}
      <svg width="16" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <rect x="1" y="9" width="4" height="6" rx="0.5" fill="currentColor" />
        <rect x="6" y="5" width="4" height="10" rx="0.5" fill="currentColor" />
        <rect x="11" y="1" width="4" height="14" rx="0.5" fill="currentColor" />
      </svg>
      Report
    </motion.button>
  );
}
