// FILE: client/src/components/right-panel/OrdersFilterBar.tsx
// PURPOSE: Horizontal pill row for filtering orders by time range
// USED BY: OrdersTab.tsx
// EXPORTS: OrdersFilterBar

import type { OrderTimeFilter } from '../../utils/orders-filter';
import { ORDER_FILTER_OPTIONS } from '../../utils/orders-filter';

interface OrdersFilterBarProps {
  activeFilter: OrderTimeFilter | null;
  onFilterChange: (filter: OrderTimeFilter | null) => void;
  filteredCount: number;
  totalCount: number;
}

export function OrdersFilterBar({
  activeFilter,
  onFilterChange,
  filteredCount,
  totalCount,
}: OrdersFilterBarProps) {
  const isFiltered = activeFilter !== null;

  return (
    <div className="flex items-center gap-2 border-b border-[var(--color-gold-subtle)] px-[var(--spacing-3xl)] py-[var(--spacing-base)]">
      {ORDER_FILTER_OPTIONS.map((option) => {
        const isActive = activeFilter === option.key;
        return (
          <button
            key={option.key}
            type="button"
            onClick={() => onFilterChange(isActive ? null : option.key)}
            className={`cursor-pointer rounded-full px-3 py-1 text-[12px] transition-[background-color,color,box-shadow] duration-150 ${
              isActive
                ? 'bg-[var(--color-dark)] text-white font-semibold border border-transparent'
                : 'border border-[var(--color-gold-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-gold-primary)] hover:text-[var(--color-text-secondary)]'
            }`}
            aria-pressed={isActive}
          >
            {option.label}
          </button>
        );
      })}

      <div className="flex-1" />

      {isFiltered && (
        <span className="text-[11px] text-[var(--color-text-muted)]">
          Showing {filteredCount} of {totalCount}
        </span>
      )}
    </div>
  );
}
