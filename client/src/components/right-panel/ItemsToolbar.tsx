// FILE: client/src/components/right-panel/ItemsToolbar.tsx
// PURPOSE: Search + group-by dropdowns + sort dropdown + filter chips for Items tab
// USED BY: ItemsExplorer.tsx
// EXPORTS: ItemsToolbar

import { useState, useRef, useEffect } from 'react';
import type { ItemDimensionKey, ItemFilters } from '../../utils/items-filter';
import type { ItemSortField } from '../../utils/items-grouping';
import type { FlatItem } from '@shared/types/dashboard';
import { GroupDropdown, FilterChip, getNextAvailable, SORT_LABELS, FILTER_FIELDS } from './ItemsToolbarControls';

interface ItemsToolbarProps {
  searchTerm: string;
  onSearch: (term: string) => void;
  groupLevels: ItemDimensionKey[];
  onGroupLevelsChange: (levels: ItemDimensionKey[]) => void;
  sortField: ItemSortField;
  sortDirection: 'asc' | 'desc';
  onToggleSort: (field: ItemSortField) => void;
  filters: ItemFilters;
  onSetFilter: (field: ItemDimensionKey, values: string[]) => void;
  onClearAllFilters: () => void;
  items: FlatItem[];
  totalCount: number;
  filteredCount: number;
}

export function ItemsToolbar({
  searchTerm, onSearch, groupLevels, onGroupLevelsChange,
  sortField, sortDirection, onToggleSort,
  filters, onSetFilter, onClearAllFilters,
  items, totalCount, filteredCount,
}: ItemsToolbarProps) {
  const [localSearch, setLocalSearch] = useState(searchTerm);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /** WHY: Sync external reset (entity change) to local input */
  useEffect(() => { setLocalSearch(searchTerm); }, [searchTerm]);

  function handleSearchChange(value: string) {
    setLocalSearch(value);
    clearTimeout(timerRef.current);
    if (!value) { onSearch(''); return; }
    timerRef.current = setTimeout(() => onSearch(value), 200);
  }

  const hasActiveFilters = Object.values(filters).some(v => v && v.length > 0);
  const isFiltered = totalCount !== filteredCount;

  return (
    <div className="sticky top-0 z-10 bg-[var(--color-bg-card)] border-b border-[var(--color-gold-subtle)] px-[var(--spacing-3xl)] py-[var(--spacing-base)] space-y-2">
      {/* Row 1: Search + Group By */}
      <div className="flex items-center gap-3">
        <SearchInput value={localSearch} onChange={handleSearchChange} />

        <div className="flex items-center gap-1.5 text-[12px] text-[var(--color-text-muted)]">
          <span>Group:</span>
          {groupLevels.map((level, i) => (
            <GroupDropdown
              key={i}
              value={level}
              excluded={groupLevels.filter((_, j) => j !== i)}
              onChange={val => {
                const next = [...groupLevels];
                if (val === 'none') { onGroupLevelsChange(next.slice(0, i)); }
                else { next[i] = val as ItemDimensionKey; onGroupLevelsChange(next); }
              }}
              onRemove={i > 0 ? () => onGroupLevelsChange(groupLevels.filter((_, j) => j !== i)) : undefined}
            />
          ))}
          {groupLevels.length < 3 && groupLevels.length > 0 && (
            <button
              type="button"
              onClick={() => onGroupLevelsChange([...groupLevels, getNextAvailable(groupLevels)])}
              className="px-2 py-0.5 rounded border border-dashed border-[var(--color-gold-subtle)] text-[11px] text-[var(--color-text-muted)] hover:border-[var(--color-gold-primary)]"
            >
              + Level
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Sort + Filter Chips + Count */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-[12px] text-[var(--color-text-muted)]">
          <span>Sort:</span>
          <select
            value={sortField}
            onChange={e => onToggleSort(e.target.value as ItemSortField)}
            className="bg-transparent border border-[var(--color-gold-subtle)] rounded px-1.5 py-0.5 text-[12px] text-[var(--color-text-primary)] outline-none"
          >
            {Object.entries(SORT_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button type="button" onClick={() => onToggleSort(sortField)} className="text-[11px] px-1 hover:text-[var(--color-text-primary)]">
            {sortDirection === 'asc' ? '\u2191' : '\u2193'}
          </button>
        </div>

        <div className="flex items-center gap-1.5 flex-1 overflow-x-auto">
          {FILTER_FIELDS.map(field => (
            <FilterChip key={field} field={field} items={items} activeValues={filters[field] ?? []} onChange={values => onSetFilter(field, values)} />
          ))}
          {hasActiveFilters && (
            <button type="button" onClick={onClearAllFilters} className="text-[11px] text-[var(--color-gold-primary)] hover:underline whitespace-nowrap">
              Clear all
            </button>
          )}
        </div>

        {isFiltered && (
          <span className="text-[11px] text-[var(--color-text-muted)] whitespace-nowrap">
            {filteredCount} of {totalCount}
          </span>
        )}
      </div>
    </div>
  );
}

function SearchInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative flex-1 max-w-[220px]">
      <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Search items..."
        className="w-full h-[32px] rounded-[var(--radius-xl)] bg-[var(--color-bg-card)] border border-[var(--color-gold-subtle)] pl-8 pr-7 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-gold-primary)]"
      />
      {value && (
        <button type="button" onClick={() => onChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Clear search">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l6 6M9 3l-6 6" /></svg>
        </button>
      )}
    </div>
  );
}
