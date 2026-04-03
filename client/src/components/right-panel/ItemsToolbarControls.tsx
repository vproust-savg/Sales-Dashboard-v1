// FILE: client/src/components/right-panel/ItemsToolbarControls.tsx
// PURPOSE: Popover panel contents for Items toolbar (search, group, sort, filter)
// USED BY: ItemsToolbar.tsx
// EXPORTS: GroupPanel, SortPanel, FilterPanel

import type { ItemDimensionKey, ItemFilters } from '../../utils/items-filter';
import type { ItemSortField } from '../../utils/items-grouping';
import type { FlatItem } from '@shared/types/dashboard';

const DIMENSION_LABELS: Record<ItemDimensionKey, string> = {
  productType: 'Product Type', productFamily: 'Product Family', brand: 'Brand',
  countryOfOrigin: 'Country of Origin', foodServiceRetail: 'FS/Retail', vendor: 'Vendor',
};

const SORT_LABELS: Record<ItemSortField, string> = {
  name: 'Name', value: 'Value', marginPercent: 'Margin %', marginAmount: 'Margin $',
};

const FILTER_FIELDS: ItemDimensionKey[] = ['productType', 'productFamily', 'brand', 'countryOfOrigin', 'foodServiceRetail'];
const ALL_DIMENSIONS: ItemDimensionKey[] = ['productType', 'productFamily', 'brand', 'countryOfOrigin', 'foodServiceRetail', 'vendor'];

/* --- Search Panel --- */

/* --- Group Panel --- */

export function GroupPanel({ groupLevels, onGroupLevelsChange }: {
  groupLevels: ItemDimensionKey[]; onGroupLevelsChange: (levels: ItemDimensionKey[]) => void;
}) {
  const getNextAvailable = () => ALL_DIMENSIONS.find(k => !groupLevels.includes(k)) ?? 'productType';

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide">Group by</div>
      {groupLevels.map((level, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] text-[var(--color-text-muted)] w-12">Level {i + 1}</span>
          <select value={level} onChange={e => {
            const val = e.target.value;
            if (val === 'none') { onGroupLevelsChange(groupLevels.slice(0, i)); }
            else { const next = [...groupLevels]; next[i] = val as ItemDimensionKey; onGroupLevelsChange(next); }
          }} className="flex-1 bg-transparent border border-[var(--color-gold-subtle)] rounded px-2 py-1 text-[12px] text-[var(--color-text-primary)] outline-none">
            {Object.entries(DIMENSION_LABELS).filter(([k]) => !groupLevels.includes(k as ItemDimensionKey) || k === level).map(([k, label]) => (
              <option key={k} value={k}>{label}</option>
            ))}
            <option value="none">None</option>
          </select>
          {i > 0 && (
            <button type="button" onClick={() => onGroupLevelsChange(groupLevels.filter((_, j) => j !== i))}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Remove level">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l6 6M9 3l-6 6" /></svg>
            </button>
          )}
        </div>
      ))}
      {groupLevels.length < 3 && (
        <button type="button" onClick={() => onGroupLevelsChange([...groupLevels, getNextAvailable()])}
          className="text-[11px] text-[var(--color-gold-primary)] hover:underline">
          + Add level
        </button>
      )}
      {groupLevels.length > 0 && (
        <button type="button" onClick={() => onGroupLevelsChange([])}
          className="text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] ml-2">
          Remove all
        </button>
      )}
    </div>
  );
}

/* --- Sort Panel --- */

export function SortPanel({ sortField, sortDirection, onToggleSort }: {
  sortField: ItemSortField; sortDirection: 'asc' | 'desc'; onToggleSort: (field: ItemSortField) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide mb-2">Sort by</div>
      {(Object.entries(SORT_LABELS) as [ItemSortField, string][]).map(([key, label]) => {
        const isActive = sortField === key;
        return (
          <button key={key} type="button" onClick={() => onToggleSort(key)}
            className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[12px] transition-colors ${
              isActive ? 'bg-[var(--color-gold-hover)] text-[var(--color-text-primary)] font-semibold' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-gold-hover)]'
            }`}>
            <span>{label}</span>
            {isActive && <span className="text-[var(--color-gold-primary)]">{sortDirection === 'asc' ? '↑ Asc' : '↓ Desc'}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* --- Filter Panel --- */

export function FilterPanel({ filters, onSetFilter, onClearAllFilters, items }: {
  filters: ItemFilters; onSetFilter: (field: ItemDimensionKey, values: string[]) => void;
  onClearAllFilters: () => void; items: FlatItem[];
}) {
  const hasActive = Object.values(filters).some(v => v && v.length > 0);

  return (
    <div className="space-y-3 max-h-[300px] overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide">Filter</span>
        {hasActive && (
          <button type="button" onClick={onClearAllFilters} className="text-[11px] text-[var(--color-gold-primary)] hover:underline">Clear all</button>
        )}
      </div>
      {FILTER_FIELDS.map(field => {
        const distinctValues = [...new Set(items.map(i => i[field]))].filter(Boolean).sort();
        const activeValues = filters[field] ?? [];
        return (
          <div key={field}>
            <div className="text-[11px] font-medium text-[var(--color-text-secondary)] mb-1">{DIMENSION_LABELS[field]}</div>
            <div className="flex flex-wrap gap-1">
              {distinctValues.map(val => {
                const isChecked = activeValues.includes(val);
                return (
                  <button key={val} type="button" onClick={() => {
                    const next = isChecked ? activeValues.filter(v => v !== val) : [...activeValues, val];
                    onSetFilter(field, next);
                  }} className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                    isChecked
                      ? 'border-[var(--color-gold-primary)] text-[var(--color-gold-primary)] bg-[var(--color-gold-hover)]'
                      : 'border-[var(--color-gold-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-gold-primary)]'
                  }`}>
                    {val}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
