// FILE: client/src/utils/items-filter.ts
// PURPOSE: Filter flat items by category chip selections (AND across fields, OR within field)
// USED BY: client/src/hooks/useItemsExplorer.ts
// EXPORTS: filterItems, type ItemFilters, type ItemDimensionKey

import type { FlatItem } from '@shared/types/dashboard';

/** WHY client-only type — UI concern for grouping/filtering, not an API contract */
export type ItemDimensionKey =
  | 'productType'
  | 'productFamily'
  | 'brand'
  | 'countryOfOrigin'
  | 'foodServiceRetail'
  | 'vendor';

export type ItemFilters = Partial<Record<ItemDimensionKey, string[]>>;

export function filterItems(items: FlatItem[], filters: ItemFilters): FlatItem[] {
  const activeEntries = Object.entries(filters).filter(
    ([, values]) => values && values.length > 0,
  ) as [ItemDimensionKey, string[]][];

  if (activeEntries.length === 0) return items;

  return items.filter(item =>
    activeEntries.every(([field, values]) => values.includes(item[field])),
  );
}
