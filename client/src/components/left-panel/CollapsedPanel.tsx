// FILE: client/src/components/left-panel/CollapsedPanel.tsx
// PURPOSE: Narrow 48px rail shown when left panel is collapsed — expand button + vertical dimension label
// USED BY: DashboardLayout.tsx
// EXPORTS: CollapsedPanel

import type { Dimension } from '@shared/types/dashboard';
import { DIMENSION_CONFIG } from '../../utils/dimension-config';

interface CollapsedPanelProps {
  activeDimension: Dimension;
  onExpand: () => void;
}

export function CollapsedPanel({ activeDimension, onExpand }: CollapsedPanelProps) {
  return (
    <div className="flex h-full w-[48px] shrink-0 flex-col items-center gap-[var(--spacing-lg)] rounded-[var(--radius-3xl)] bg-[var(--color-bg-card)] py-[var(--spacing-2xl)] shadow-[var(--shadow-card)]">
      {/* Expand button */}
      <button
        type="button"
        onClick={onExpand}
        className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[var(--radius-base)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-gold-subtle)] hover:text-[var(--color-text-secondary)]"
        aria-label="Expand panel"
        title="Expand panel (or press [)"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* WHY: writing-mode + rotate(180deg) renders the label top-to-bottom so it reads
       *  naturally along the left edge without overlapping the expand button */}
      <div className="flex flex-1 items-center justify-center">
        <span
          className="text-[11px] font-semibold tracking-[0.15em] text-[var(--color-text-muted)]"
          style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
        >
          {DIMENSION_CONFIG[activeDimension].label.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
