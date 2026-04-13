// FILE: client/src/components/left-panel/SelectionBar.tsx
// PURPOSE: Slide-up bar at bottom of entity list showing selected count + "View Consolidated"
// USED BY: client/src/components/left-panel/LeftPanel.tsx
// EXPORTS: SelectionBar

import { AnimatePresence, motion } from 'framer-motion';

interface SelectionBarProps {
  selectedCount: number;
  dataLoaded: boolean;
  onViewConsolidated: () => void;
  onClear: () => void;
}

export function SelectionBar({ selectedCount, dataLoaded, onViewConsolidated, onClear }: SelectionBarProps) {
  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 57, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 57, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          className="
            sticky bottom-0 z-10
            flex h-[57px] items-center justify-between
            border-t border-[var(--color-gold-muted)]
            bg-[var(--color-bg-page)] px-[var(--spacing-2xl)] py-[var(--spacing-base)]
            backdrop-blur-[8px]
          "
        >
          {/* Left — selected count with checkbox icon */}
          <div className="flex items-center gap-[var(--spacing-sm)]">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="12" height="12" rx="3" stroke="var(--color-gold-primary)" strokeWidth="1.5" />
              <path d="M4 7L6 9L10 5" stroke="var(--color-gold-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
              {selectedCount} selected
            </span>
          </div>

          {/* Right — "View Consolidated" button + "Clear" link */}
          <div className="flex items-center gap-[var(--spacing-md)]">
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-[var(--color-text-muted)] underline transition-colors duration-100 hover:text-[var(--color-text-secondary)]"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={dataLoaded ? onViewConsolidated : undefined}
              disabled={!dataLoaded}
              title={dataLoaded ? undefined : 'Load all data first to view consolidated'}
              className={`
                h-[36px] rounded-[var(--radius-base)] bg-[var(--color-dark)]
                px-[var(--spacing-lg)] py-[5px] text-[11px] font-medium text-white
                transition-colors duration-150
                ${dataLoaded ? 'hover:bg-[var(--color-dark-hover)]' : 'cursor-not-allowed opacity-50'}
              `}
            >
              View Consolidated
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
