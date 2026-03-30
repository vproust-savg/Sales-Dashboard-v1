// FILE: client/src/components/left-panel/EntityListItem.tsx
// PURPOSE: Single row in the entity list — checkbox, name, meta, revenue
// USED BY: client/src/components/left-panel/EntityList.tsx
// EXPORTS: EntityListItem (component)

import type { EntityListItem as EntityListItemType } from '@shared/types/dashboard';

interface EntityListItemProps {
  entity: EntityListItemType;
  isActive: boolean;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onCheck: (id: string) => void;
}

/** WHY: separate formatter avoids importing a utility for a simple "$X,XXX" pattern */
function formatRevenue(value: number): string {
  if (value >= 1000) {
    return `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K`;
  }
  return `$${value.toLocaleString()}`;
}

export function EntityListItem({ entity, isActive, isSelected, onSelect, onCheck }: EntityListItemProps) {
  /** WHY: active state uses asymmetric padding — 13px left compensates for 3px border */
  const paddingClass = isActive
    ? 'py-[var(--spacing-lg)] pr-[var(--spacing-2xl)] pl-[13px]'
    : 'py-[var(--spacing-lg)] px-[var(--spacing-2xl)]';

  const bgClass = isActive
    ? 'bg-[#f0ebe3]'
    : isSelected
      ? 'bg-[#f7f3ed]'
      : 'bg-transparent hover:bg-[var(--color-gold-hover)]';

  return (
    <div
      role="option"
      aria-selected={isActive}
      tabIndex={isActive ? 0 : -1}
      onClick={() => onSelect(entity.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect(entity.id);
        }
      }}
      className={`
        relative flex cursor-pointer items-start gap-[var(--spacing-md)]
        ${paddingClass} ${bgClass}
        transition-colors duration-100
      `}
    >
      {/* WHY: 3px gold left border indicates active item — spec Section 3.5 */}
      {isActive && (
        <div className="absolute left-0 top-0 h-full w-[3px] rounded-r-[2px] bg-[var(--color-gold-primary)]" />
      )}

      {/* Circular checkbox — 18x18, gold fill when selected */}
      <button
        type="button"
        aria-label={`Select ${entity.name}`}
        onClick={(e) => {
          e.stopPropagation();
          onCheck(entity.id);
        }}
        className={`
          mt-[2px] flex h-[18px] w-[18px] shrink-0 items-center justify-center
          rounded-full border transition-colors duration-100
          ${isSelected
            ? 'border-[var(--color-gold-primary)] bg-[var(--color-gold-primary)]'
            : 'border-[var(--color-gold-muted)] bg-transparent hover:border-[var(--color-gold-primary)]'
          }
        `}
      >
        {isSelected && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true">
            <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Entity content — name, meta1, meta2, revenue */}
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--spacing-2xs)]">
        <div className="flex items-start justify-between gap-[var(--spacing-md)]">
          <span className="truncate text-[13px] font-semibold text-[var(--color-text-primary)]">
            {entity.name}
          </span>
          <span className="shrink-0 text-[13px] font-bold tabular-nums text-[var(--color-text-primary)]">
            {formatRevenue(entity.revenue)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="truncate text-[11px] text-[var(--color-text-muted)]">
            {entity.meta1}
          </span>
          <span className="shrink-0 text-[11px] text-[var(--color-text-muted)]">
            {entity.meta2}
          </span>
        </div>
      </div>
    </div>
  );
}
