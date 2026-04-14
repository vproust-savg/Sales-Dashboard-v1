// FILE: client/src/utils/items-grouping.ts
// PURPOSE: Multi-level grouping, sorting, and aggregation for FlatItem arrays
// USED BY: client/src/hooks/useItemsExplorer.ts
// EXPORTS: groupItems, sortFlatItems, GroupNode, ItemSortField

import type { FlatItem } from '@shared/types/dashboard';
import type { ItemDimensionKey } from './items-filter';

/** WHY client-only type — sort field is a UI concern, not an API contract */
export type ItemSortField = 'name' | 'value' | 'marginPercent' | 'marginAmount' | 'totalUnits' | 'purchaseFrequency' | 'lastPrice' | 'lastOrderDate';

export interface GroupNode {
  key: string;
  label: string;
  items: FlatItem[];
  children: GroupNode[];
  totals: {
    value: number;
    marginPercent: number;
    marginAmount: number;
    itemCount: number;
  };
}

export function groupItems(
  items: FlatItem[],
  levels: ItemDimensionKey[],
  sortField: ItemSortField,
  sortDirection: 'asc' | 'desc',
): GroupNode[] {
  if (levels.length === 0) return [];
  return buildLevel(items, levels, 0, '', sortField, sortDirection);
}

function buildLevel(
  items: FlatItem[],
  levels: ItemDimensionKey[],
  depth: number,
  parentKey: string,
  sortField: ItemSortField,
  sortDirection: 'asc' | 'desc',
): GroupNode[] {
  const field = levels[depth];
  const groups = new Map<string, FlatItem[]>();

  items.forEach(item => {
    const label = item[field] || 'Other';
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  });

  const isDeepest = depth === levels.length - 1;

  const nodes: GroupNode[] = [...groups.entries()].map(([label, groupItems]) => {
    const key = parentKey ? `${parentKey}|${label}` : label;
    const children = isDeepest
      ? []
      : buildLevel(groupItems, levels, depth + 1, key, sortField, sortDirection);
    const sortedItems = isDeepest ? sortFlatItems(groupItems, sortField, sortDirection) : groupItems;

    const totalValue = groupItems.reduce((s, i) => s + i.value, 0);
    const totalMarginAmount = groupItems.reduce((s, i) => s + i.marginAmount, 0);

    return {
      key,
      label,
      items: isDeepest ? sortedItems : groupItems,
      children,
      totals: {
        value: totalValue,
        marginPercent: totalValue > 0 ? (totalMarginAmount / totalValue) * 100 : 0,
        marginAmount: totalMarginAmount,
        itemCount: groupItems.length,
      },
    };
  });

  return sortGroups(nodes, sortField, sortDirection);
}

/** WHY: Group totals only have value/marginPercent/marginAmount — fallback to value for item-only fields */
const GROUP_SORTABLE_FIELDS = new Set<string>(['value', 'marginPercent', 'marginAmount']);

function sortGroups(nodes: GroupNode[], field: ItemSortField, dir: 'asc' | 'desc'): GroupNode[] {
  const effectiveField = GROUP_SORTABLE_FIELDS.has(field) ? field : 'value';
  return [...nodes].sort((a, b) => {
    /** WHY: "Other" always sorts last regardless of field/direction */
    if (a.label === 'Other') return 1;
    if (b.label === 'Other') return -1;

    const aVal = effectiveField === 'name' ? a.label : a.totals[effectiveField as keyof GroupNode['totals']];
    const bVal = effectiveField === 'name' ? b.label : b.totals[effectiveField as keyof GroupNode['totals']];

    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const diff = (aVal as number) - (bVal as number);
    return dir === 'asc' ? diff : -diff;
  });
}

export function sortFlatItems(items: FlatItem[], field: ItemSortField, dir: 'asc' | 'desc'): FlatItem[] {
  return [...items].sort((a, b) => {
    const aVal = a[field];
    const bVal = b[field];
    /** WHY: lastOrderDate is string | null — null vs string produces NaN without this guard.
     *  Nulls sort last regardless of direction so "no history" items sink to bottom. */
    if (aVal === null && bVal === null) return 0;
    if (aVal === null) return 1;
    if (bVal === null) return -1;
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    const diff = (aVal as number) - (bVal as number);
    return dir === 'asc' ? diff : -diff;
  });
}
