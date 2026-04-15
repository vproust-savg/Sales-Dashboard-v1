// FILE: client/src/components/left-panel/SelectionBar.tsx
// PURPOSE: Slide-up bar at bottom of entity list showing selected count, Clear, and View Consolidated 2 button
// USED BY: client/src/components/left-panel/LeftPanel.tsx
// EXPORTS: SelectionBar

import { AnimatePresence, motion } from 'framer-motion';
import { ViewConsolidated2Button } from './ViewConsolidated2Button';

interface SelectionBarProps {
  selectedCount: number;
  onViewConsolidated2: () => void;
  onClear: () => void;
}

export function SelectionBar({ selectedCount, onViewConsolidated2, onClear }: SelectionBarProps) {
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

          {/* Right — Clear link + v2 View Consolidated button */}
          <div className="flex items-center gap-[var(--spacing-md)]">
            <button
              type="button"
              onClick={onClear}
              className="text-[11px] text-[var(--color-text-muted)] underline transition-colors duration-100 hover:text-[var(--color-text-secondary)]"
            >
              Clear
            </button>
            <ViewConsolidated2Button onClick={onViewConsolidated2} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
