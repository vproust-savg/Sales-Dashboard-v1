// FILE: client/src/components/left-panel/FilterSortToolbar.tsx
// PURPOSE: Filter + Sort buttons side by side above the entity list, with active filter count badge
// USED BY: client/src/components/left-panel/LeftPanel.tsx
// EXPORTS: FilterSortToolbar

interface FilterSortToolbarProps {
  onFilterToggle: () => void;
  onSortToggle: () => void;
  filterActive: boolean;
  sortActive: boolean;
  filterCount?: number;
}

export function FilterSortToolbar({
  onFilterToggle,
  onSortToggle,
  filterActive,
  sortActive,
  filterCount,
}: FilterSortToolbarProps) {
  return (
    <div className="flex gap-[var(--spacing-md)]">
      {/* Filter button — dark bg when active, gold-subtle when inactive */}
      <button
        type="button"
        onClick={onFilterToggle}
        aria-pressed={filterActive}
        className={`
          flex h-[36px] flex-1 items-center justify-center gap-[var(--spacing-sm)]
          rounded-[var(--radius-lg)] px-[var(--spacing-2xl)] py-[var(--spacing-base)]
          text-[12px] font-medium transition-colors duration-150
          ${filterActive
            ? 'bg-[var(--color-dark)] text-white hover:bg-[var(--color-dark-hover)]'
            : 'bg-[var(--color-gold-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-gold-muted)]'
          }
        `}
      >
        {/* Filter icon — 3 horizontal lines of decreasing width */}
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true">
          <line x1="0" y1="1" x2="14" y2="1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="2" y1="5" x2="12" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="4" y1="9" x2="10" y2="9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Filter
        {/* WHY: Badge shows count of active (field+value set) filter conditions */}
        {filterCount !== undefined && filterCount > 0 && (
          <span className="inline-flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[var(--color-gold-primary)] px-1 text-[9px] font-bold text-white">
            {filterCount}
          </span>
        )}
      </button>

      {/* Sort button — shows down arrow when active */}
      <button
        type="button"
        onClick={onSortToggle}
        aria-pressed={sortActive}
        className={`
          flex h-[36px] flex-1 items-center justify-center gap-[var(--spacing-sm)]
          rounded-[var(--radius-lg)] px-[var(--spacing-2xl)] py-[var(--spacing-base)]
          text-[12px] font-medium transition-colors duration-150
          ${sortActive
            ? 'bg-[var(--color-dark)] text-white hover:bg-[var(--color-dark-hover)]'
            : 'bg-[var(--color-gold-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-gold-muted)]'
          }
        `}
      >
        {/* Sort icon — arrows up/down */}
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
          <path d="M4 1v10M4 1L1 4M4 1l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M8 11V1M8 11l3-3M8 11L5 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Sort
        {sortActive && <span aria-hidden="true">&#8595;</span>}
      </button>
    </div>
  );
}
