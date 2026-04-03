// FILE: client/src/components/right-panel/ItemsToolbar.tsx
// PURPOSE: Minimalist icon bar with expandable search + popover panels for Items tab
// USED BY: ItemsExplorer.tsx
// EXPORTS: ItemsToolbar

import { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { ItemDimensionKey, ItemFilters } from '../../utils/items-filter';
import type { ItemSortField } from '../../utils/items-grouping';
import type { FlatItem } from '@shared/types/dashboard';
import { GroupPanel, SortPanel, FilterPanel } from './ItemsToolbarControls';

type PanelKey = 'group' | 'sort' | 'filter' | null;

export interface ItemsToolbarProps {
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

export function ItemsToolbar(props: ItemsToolbarProps) {
  const {
    searchTerm, onSearch, groupLevels, onGroupLevelsChange,
    sortField, sortDirection, onToggleSort,
    filters, onSetFilter, onClearAllFilters,
    items, totalCount, filteredCount,
  } = props;

  const [openPanel, setOpenPanel] = useState<PanelKey>(null);
  const barRef = useRef<HTMLDivElement>(null);

  /** WHY: Click-outside closes any open popover */
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenPanel(null);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (key: PanelKey) => setOpenPanel(prev => prev === key ? null : key);
  const activeFilterCount = Object.values(filters).filter(v => v && v.length > 0).length;
  const isFiltered = totalCount !== filteredCount;

  return (
    <div ref={barRef} className="sticky top-0 z-10 bg-[var(--color-bg-card)] border-b border-[var(--color-gold-subtle)] px-[var(--spacing-3xl)] py-[var(--spacing-base)]">
      <div className="flex items-center gap-2">
        {/* Expandable search bar */}
        <ExpandableSearch searchTerm={searchTerm} onSearch={onSearch} />

        {/* Group */}
        <ToolbarIcon panel="group" openPanel={openPanel} onToggle={toggle} badge={groupLevels.length > 0 ? groupLevels.length : null}
          icon={<><rect x="3" y="3" width="14" height="3" rx="1" /><rect x="5" y="9" width="10" height="3" rx="1" /><rect x="7" y="15" width="6" height="3" rx="1" /></>} />

        {/* Sort */}
        <ToolbarIcon panel="sort" openPanel={openPanel} onToggle={toggle} badge={null}
          label={sortDirection === 'asc' ? '↑' : '↓'}
          icon={<><path d="M6 4v12M6 4l-3 3M6 4l3 3" /><path d="M14 16V4M14 16l-3-3M14 16l3-3" /></>} />

        {/* Filter */}
        <ToolbarIcon panel="filter" openPanel={openPanel} onToggle={toggle} badge={activeFilterCount > 0 ? activeFilterCount : null}
          icon={<><path d="M3 4h14M5 9h10M7 14h6" /></>} />

        {/* Spacer + filtered count */}
        <div className="flex-1" />
        {isFiltered && (
          <span className="text-[11px] text-[var(--color-text-muted)]">
            {filteredCount} of {totalCount}
          </span>
        )}
      </div>

      {/* Popover panels */}
      <AnimatePresence>
        {openPanel && (
          <motion.div
            key={openPanel}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute left-[var(--spacing-3xl)] right-[var(--spacing-3xl)] top-full mt-1 z-20 rounded-xl border border-[var(--color-gold-subtle)] bg-[var(--color-bg-card)] shadow-lg p-3 max-h-[260px] overflow-y-auto"
          >
            {openPanel === 'group' && <GroupPanel groupLevels={groupLevels} onGroupLevelsChange={onGroupLevelsChange} />}
            {openPanel === 'sort' && <SortPanel sortField={sortField} sortDirection={sortDirection} onToggleSort={onToggleSort} />}
            {openPanel === 'filter' && <FilterPanel filters={filters} onSetFilter={onSetFilter} onClearAllFilters={onClearAllFilters} items={items} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --- Expandable search bar: compact icon → full input on click --- */

function ExpandableSearch({ searchTerm, onSearch }: { searchTerm: string; onSearch: (term: string) => void }) {
  const [expanded, setExpanded] = useState(!!searchTerm);
  const [local, setLocal] = useState(searchTerm);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setLocal(searchTerm); if (!searchTerm) setExpanded(false); }, [searchTerm]);

  function handleChange(value: string) {
    setLocal(value);
    clearTimeout(timerRef.current);
    if (!value) { onSearch(''); return; }
    timerRef.current = setTimeout(() => onSearch(value), 200);
  }

  function handleExpand() {
    setExpanded(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleClear() {
    setLocal('');
    onSearch('');
    setExpanded(false);
  }

  /** WHY: Collapse on blur only if empty — keeps search visible when text is present */
  function handleBlur() {
    if (!local) setExpanded(false);
  }

  return (
    <div className="flex items-center">
      <motion.div
        animate={{ width: expanded ? 180 : 28 }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className="relative h-7 flex items-center overflow-hidden rounded-full border border-[var(--color-gold-subtle)]"
      >
        {/* Magnifying glass — always visible */}
        <button
          type="button"
          onClick={handleExpand}
          className="absolute left-0 w-7 h-7 flex items-center justify-center shrink-0 text-[var(--color-text-muted)]"
          aria-label="Search items"
        >
          <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="9" r="6" /><path d="m14 14-3.5-3.5" />
          </svg>
        </button>

        {/* Input — slides in from behind the icon */}
        {expanded && (
          <input
            ref={inputRef}
            type="text"
            value={local}
            onChange={e => handleChange(e.target.value)}
            onBlur={handleBlur}
            placeholder="Search..."
            className="w-full h-full bg-transparent pl-8 pr-6 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] outline-none"
          />
        )}

        {/* Clear × */}
        {expanded && local && (
          <button type="button" onClick={handleClear}
            className="absolute right-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]" aria-label="Clear search">
            <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3l6 6M9 3l-6 6" /></svg>
          </button>
        )}
      </motion.div>
    </div>
  );
}

/* --- Reusable icon button --- */

function ToolbarIcon({ panel, openPanel, onToggle, badge, label, icon }: {
  panel: NonNullable<PanelKey>; openPanel: PanelKey; onToggle: (key: PanelKey) => void;
  badge: number | null; label?: string;
  icon: React.ReactNode;
}) {
  const isOpen = openPanel === panel;
  const isActive = badge !== null || isOpen;

  return (
    <button
      type="button"
      onClick={() => onToggle(panel)}
      className={`relative w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 ${
        isOpen
          ? 'bg-[var(--color-gold-primary)] text-white'
          : isActive
            ? 'border border-[var(--color-gold-primary)] text-[var(--color-gold-primary)]'
            : 'border border-[var(--color-gold-subtle)] text-[var(--color-text-muted)] hover:border-[var(--color-gold-primary)] hover:text-[var(--color-text-secondary)]'
      }`}
      aria-label={panel}
      aria-expanded={isOpen}
    >
      <svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {icon}
      </svg>
      {label && !isOpen && (
        <span className="absolute -bottom-0.5 -right-0.5 text-[8px] font-bold text-[var(--color-gold-primary)]">{label}</span>
      )}
      {badge !== null && !isOpen && (
        <span className="absolute -top-1 -right-1 flex h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[var(--color-gold-primary)] px-0.5 text-[8px] font-bold text-white">
          {badge}
        </span>
      )}
    </button>
  );
}
