// FILE: client/src/components/left-panel/CollapsedPanel.tsx
// PURPOSE: Narrow 48px rail shown when left panel is collapsed — expand button + dimension icon
// USED BY: DashboardLayout.tsx
// EXPORTS: CollapsedPanel

import type { Dimension } from '@shared/types/dashboard';

interface CollapsedPanelProps {
  activeDimension: Dimension;
  onExpand: () => void;
}

/** WHY: Map dimensions to single-letter representations for the collapsed rail */
const DIMENSION_ICONS: Record<Dimension, string> = {
  customer: 'C',
  zone: 'Z',
  vendor: 'V',
  brand: 'B',
  product_type: 'T',
  product: 'P',
};

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

      {/* Active dimension indicator */}
      <div
        className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-dark)] text-[10px] font-bold text-white"
        title={activeDimension}
      >
        {DIMENSION_ICONS[activeDimension]}
      </div>
    </div>
  );
}
