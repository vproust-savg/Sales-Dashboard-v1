// FILE: client/src/components/right-panel/ItemsTable.tsx
// PURPOSE: Table with column headers + recursive group rendering or flat list
// USED BY: ItemsExplorer.tsx
// EXPORTS: ItemsTable

import { motion, AnimatePresence } from 'framer-motion';
import type { FlatItem } from '@shared/types/dashboard';
import type { GroupNode, ItemSortField } from '../../utils/items-grouping';
import { ItemsGroupRow } from './ItemsGroupRow';
import { ItemsProductRow } from './ItemsProductRow';

interface ItemsTableProps {
  groups: GroupNode[];
  flatItems: FlatItem[];
  isGrouped: boolean;
  sortField: ItemSortField;
  sortDirection: 'asc' | 'desc';
  expandedGroups: Set<string>;
  onToggleSort: (field: ItemSortField) => void;
  onToggleGroup: (key: string) => void;
}

const COLUMNS: { label: string; field: ItemSortField | null; width: string }[] = [
  { label: 'Product', field: 'name', width: 'flex-1' },
  { label: 'Value', field: 'value', width: 'w-28' },
  { label: 'Margin %', field: 'marginPercent', width: 'w-24' },
  { label: 'Margin $', field: 'marginAmount', width: 'w-28' },
];

function SortArrow({ field, sortField, sortDirection }: { field: ItemSortField; sortField: ItemSortField; sortDirection: string }) {
  if (field !== sortField) return null;
  return <span className="ml-1 text-[9px]">{sortDirection === 'asc' ? '\u2191' : '\u2193'}</span>;
}

export function ItemsTable({ groups, flatItems, isGrouped, sortField, sortDirection, expandedGroups, onToggleSort, onToggleGroup }: ItemsTableProps) {
  return (
    /* WHY max-w: prevent product name from stretching too far from numbers on wide screens */
    <div className="overflow-x-auto">
      <div className="min-w-[600px] max-w-[1100px]" role={isGrouped ? 'treegrid' : 'table'} aria-label="Items explorer">
        {/* Column headers */}
        <div className="flex items-center border-b border-[var(--color-gold-subtle)] px-[var(--spacing-3xl)] py-[var(--spacing-lg)]" role="row">
          {COLUMNS.map(col => (
            <button
              key={col.label}
              type="button"
              role="columnheader"
              aria-sort={col.field === sortField ? (sortDirection === 'asc' ? 'ascending' : 'descending') : undefined}
              onClick={col.field ? () => onToggleSort(col.field!) : undefined}
              className={`${col.width} text-${col.field === 'name' ? 'left' : 'right'} text-[12px] font-semibold uppercase text-[var(--color-text-muted)] tracking-wide hover:text-[var(--color-text-secondary)] transition-colors`}
            >
              {col.label}
              {col.field && <SortArrow field={col.field} sortField={sortField} sortDirection={sortDirection} />}
            </button>
          ))}
        </div>

        {/* Content: grouped or flat */}
        {isGrouped
          ? groups.map(group => (
            <GroupSection key={group.key} group={group} depth={0} expandedGroups={expandedGroups} onToggleGroup={onToggleGroup} />
          ))
          : flatItems.map(item => (
            <ItemsProductRow key={item.sku} item={item} depth={0} />
          ))
        }
      </div>
    </div>
  );
}

function GroupSection({ group, depth, expandedGroups, onToggleGroup }: {
  group: GroupNode; depth: number; expandedGroups: Set<string>; onToggleGroup: (key: string) => void;
}) {
  const isExpanded = expandedGroups.has(group.key);
  const hasChildren = group.children.length > 0;

  return (
    <div>
      <ItemsGroupRow group={group} depth={depth} isExpanded={isExpanded} onToggle={() => onToggleGroup(group.key)} />
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {hasChildren
              ? group.children.map(child => (
                <GroupSection key={child.key} group={child} depth={depth + 1} expandedGroups={expandedGroups} onToggleGroup={onToggleGroup} />
              ))
              : group.items.map(item => (
                <ItemsProductRow key={item.sku} item={item} depth={depth + 1} />
              ))
            }
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
