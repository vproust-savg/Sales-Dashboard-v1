// FILE: client/src/components/right-panel/ItemsToolbarControls.tsx
// PURPOSE: Inline panel contents for Items toolbar (group, sort, filter)
// USED BY: ItemsToolbar.tsx
// EXPORTS: GroupPanel, SortPanel, FilterPanel

import { useState, useRef, useEffect } from 'react';
import { Reorder, useDragControls } from 'framer-motion';
import type { ItemDimensionKey, ItemFilters } from '../../utils/items-filter';
import type { ItemSortField } from '../../utils/items-grouping';
import type { FlatItem } from '@shared/types/dashboard';

const DIMENSION_LABELS: Record<ItemDimensionKey, string> = {
  productType: 'Product Type', productFamily: 'Product Family', brand: 'Brand',
  countryOfOrigin: 'Country', foodServiceRetail: 'FS/Retail', vendor: 'Vendor',
};

const SORT_LABELS: Record<ItemSortField, string> = {
  name: 'Name', value: 'Value', marginPercent: 'Margin %', marginAmount: 'Margin $',
};

const FILTER_FIELDS: ItemDimensionKey[] = ['productType', 'productFamily', 'brand', 'countryOfOrigin', 'foodServiceRetail'];
const ALL_DIMENSIONS: ItemDimensionKey[] = ['productType', 'productFamily', 'brand', 'countryOfOrigin', 'foodServiceRetail', 'vendor'];

export function GroupPanel({ groupLevels, onGroupLevelsChange }: {
  groupLevels: ItemDimensionKey[]; onGroupLevelsChange: (levels: ItemDimensionKey[]) => void;
}) {
  const getNextAvailable = () => ALL_DIMENSIONS.find(k => !groupLevels.includes(k)) ?? 'productType';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide">Group by</span>
        {groupLevels.length > 0 && (
          <button type="button" onClick={() => onGroupLevelsChange([])}
            className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">
            Clear
          </button>
        )}
      </div>

      {/* WHY: Reorder.Group — drag-and-drop with spring physics, axis="x" for horizontal */}
      <Reorder.Group
        axis="x"
        values={groupLevels}
        onReorder={onGroupLevelsChange}
        className="flex items-center gap-1.5 flex-wrap"
      >
        {groupLevels.map((level) => (
          <GroupChip
            key={level}
            value={level}
            excluded={groupLevels.filter(k => k !== level)}
            onChange={(newVal) => {
              if (newVal === 'none') {
                onGroupLevelsChange(groupLevels.filter(k => k !== level));
              } else {
                onGroupLevelsChange(groupLevels.map(k => k === level ? newVal as ItemDimensionKey : k));
              }
            }}
            onRemove={() => onGroupLevelsChange(groupLevels.filter(k => k !== level))}
          />
        ))}
      </Reorder.Group>

      {groupLevels.length < 3 && (
        <button type="button" onClick={() => onGroupLevelsChange([...groupLevels, getNextAvailable()])}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-[var(--color-gold-subtle)] text-[11px] text-[var(--color-text-muted)] hover:border-[var(--color-gold-primary)] hover:text-[var(--color-gold-primary)] transition-colors">
          + Add level
        </button>)}
    </div>
  );
}

/** WHY: Reorder.Item with useDragControls — drag only from 6-dot grip handle, not from dropdown */
function GroupChip({ value, excluded, onChange, onRemove }: {
  value: ItemDimensionKey; excluded: ItemDimensionKey[];
  onChange: (val: string) => void; onRemove: () => void;
}) {
  const controls = useDragControls();
  const [pickerOpen, setPickerOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setPickerOpen(false); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <Reorder.Item
      value={value}
      dragListener={false}
      dragControls={controls}
      className="relative flex items-center gap-1 rounded-full bg-[var(--color-gold-hover)] border border-[var(--color-gold-subtle)] pl-1 pr-1.5 py-0.5 select-none"
      whileDrag={{ scale: 1.05, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
    >
      {/* Grip handle — drag initiator */}
      <div
        onPointerDown={e => controls.start(e)}
        className="cursor-grab active:cursor-grabbing px-0.5 text-[var(--color-text-muted)] touch-none"
        aria-label="Drag to reorder"
      >
        <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
          <circle cx="2" cy="2" r="1" /><circle cx="6" cy="2" r="1" />
          <circle cx="2" cy="6" r="1" /><circle cx="6" cy="6" r="1" />
          <circle cx="2" cy="10" r="1" /><circle cx="6" cy="10" r="1" />
        </svg>
      </div>

      {/* Dimension label — click to change */}
      <div ref={ref} className="relative">
        <button type="button" onClick={() => setPickerOpen(!pickerOpen)}
          className="text-[11px] font-medium text-[var(--color-text-primary)] hover:text-[var(--color-gold-primary)] transition-colors whitespace-nowrap">
          {DIMENSION_LABELS[value]}
        </button>

        {pickerOpen && (
          <div className="absolute top-full left-0 mt-1 z-30 bg-[var(--color-bg-card)] border border-[var(--color-gold-subtle)] rounded-lg shadow-lg py-1 min-w-[140px]">
            {Object.entries(DIMENSION_LABELS).filter(([k]) => !excluded.includes(k as ItemDimensionKey)).map(([k, label]) => (
              <button key={k} type="button" onClick={() => { onChange(k); setPickerOpen(false); }}
                className={`block w-full text-left px-3 py-1 text-[11px] hover:bg-[var(--color-gold-hover)] transition-colors ${k === value ? 'text-[var(--color-gold-primary)] font-semibold' : 'text-[var(--color-text-primary)]'}`}>
                {label}
              </button>))}
          </div>)}
      </div>

      {/* Remove × */}
      <button type="button" onClick={onRemove}
        className="ml-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors" aria-label="Remove">
        <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l6 6M9 3l-6 6" /></svg>
      </button>
    </Reorder.Item>
  );
}

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
