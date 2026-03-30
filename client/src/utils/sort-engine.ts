// FILE: client/src/utils/sort-engine.ts
// PURPOSE: Client-side sort with field accessors for entity list
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: sortEntities

import type { EntityListItem } from '@shared/types/dashboard';
import type { SortField, SortDirection } from '../hooks/useSort';

/** Sort entities by the specified field and direction — spec Section 15.4 */
export function sortEntities(
  entities: EntityListItem[],
  field: SortField,
  direction: SortDirection,
): EntityListItem[] {
  const getValue = (e: EntityListItem): number | string => {
    switch (field) {
      case 'name':
        return e.name.toLowerCase();
      case 'revenue':
        return e.revenue;
      case 'orders':
        return e.orderCount;
      // WHY: Fields like avgOrder, marginPercent, frequency, outstanding, lastOrder
      // are not on EntityListItem — they come from the full dashboard payload.
      // Default to revenue sort when a non-entity field is selected.
      default:
        return e.revenue;
    }
  };

  return [...entities].sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return direction === 'asc' ? cmp : -cmp;
  });
}
