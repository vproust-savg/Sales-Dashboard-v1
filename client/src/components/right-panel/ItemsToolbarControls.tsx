// FILE: client/src/components/right-panel/ItemsToolbarControls.tsx
// PURPOSE: Sub-components for ItemsToolbar — GroupDropdown, FilterChip, getNextAvailable
// USED BY: ItemsToolbar.tsx
// EXPORTS: GroupDropdown, FilterChip, getNextAvailable, DIMENSION_LABELS, SORT_LABELS, FILTER_FIELDS

import { useState, useRef, useEffect } from 'react';
import type { ItemDimensionKey } from '../../utils/items-filter';
import type { ItemSortField } from '../../utils/items-grouping';
import type { FlatItem } from '@shared/types/dashboard';

export const DIMENSION_LABELS: Record<ItemDimensionKey, string> = {
  productType: 'Product Type',
  productFamily: 'Product Family',
  brand: 'Brand',
  countryOfOrigin: 'Country of Origin',
  foodServiceRetail: 'FS/Retail',
  vendor: 'Vendor',
};

export const SORT_LABELS: Record<ItemSortField, string> = {
  name: 'Name', value: 'Value', marginPercent: 'Margin %', marginAmount: 'Margin $',
};

export const FILTER_FIELDS: ItemDimensionKey[] = [
  'productType', 'productFamily', 'brand', 'countryOfOrigin', 'foodServiceRetail',
];

const ALL_DIMENSIONS: ItemDimensionKey[] = [
  'productType', 'productFamily', 'brand', 'countryOfOrigin', 'foodServiceRetail', 'vendor',
];

export function getNextAvailable(used: ItemDimensionKey[]): ItemDimensionKey {
  return ALL_DIMENSIONS.find(k => !used.includes(k)) ?? 'productType';
}

export function GroupDropdown({ value, excluded, onChange, onRemove }: {
  value: ItemDimensionKey; excluded: ItemDimensionKey[]; onChange: (val: string) => void; onRemove?: () => void;
}) {
  const options = Object.entries(DIMENSION_LABELS).filter(
    ([k]) => !excluded.includes(k as ItemDimensionKey),
  );

  return (
    <div className="flex items-center gap-0.5">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-transparent border border-[var(--color-gold-subtle)] rounded px-1.5 py-0.5 text-[12px] text-[var(--color-text-primary)] outline-none"
      >
        {options.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        <option value="none">None</option>
      </select>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
          aria-label="Remove level"
        >
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M3 3l6 6M9 3l-6 6" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function FilterChip({ field, items, activeValues, onChange }: {
  field: ItemDimensionKey; items: FlatItem[]; activeValues: string[]; onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const distinctValues = [...new Set(items.map(i => i[field]))].filter(Boolean).sort();
  const isActive = activeValues.length > 0;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`px-2 py-0.5 rounded-full text-[11px] border whitespace-nowrap transition-colors ${
          isActive
            ? 'border-[var(--color-gold-primary)] text-[var(--color-gold-primary)] bg-[var(--color-gold-hover)]'
            : 'border-[var(--color-gold-subtle)] text-[var(--color-text-muted)]'
        }`}
      >
        {DIMENSION_LABELS[field]}{isActive && ` (${activeValues.length})`}
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 z-20 bg-[var(--color-bg-card)] border border-[var(--color-gold-subtle)] rounded-lg shadow-lg p-2 min-w-[160px] max-h-[200px] overflow-y-auto">
          {distinctValues.map(val => (
            <label
              key={val}
              className="flex items-center gap-2 px-2 py-1 text-[12px] text-[var(--color-text-primary)] hover:bg-[var(--color-gold-hover)] rounded cursor-pointer"
            >
              <input
                type="checkbox"
                checked={activeValues.includes(val)}
                onChange={() => {
                  const next = activeValues.includes(val)
                    ? activeValues.filter(v => v !== val)
                    : [...activeValues, val];
                  onChange(next);
                }}
                className="accent-[var(--color-gold-primary)]"
              />
              {val}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
