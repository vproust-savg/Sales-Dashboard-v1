// FILE: client/src/utils/items-search.ts
// PURPOSE: Filter flat items by name or SKU substring match (case-insensitive)
// USED BY: client/src/hooks/useItemsExplorer.ts
// EXPORTS: searchItems

import type { FlatItem } from '@shared/types/dashboard';

export function searchItems(items: FlatItem[], term: string): FlatItem[] {
  if (!term) return items;
  const lower = term.toLowerCase();
  return items.filter(
    item => item.name.toLowerCase().includes(lower) || item.sku.toLowerCase().includes(lower),
  );
}
