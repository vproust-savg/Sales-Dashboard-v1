// FILE: client/src/utils/sort-engine.ts
// PURPOSE: Client-side sort with field accessors for enriched entity list
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
      case 'id':
        return e.id.toLowerCase();
      case 'name':
        return e.name.toLowerCase();
      case 'revenue':
        return e.revenue ?? -Infinity;      // WHY: null sorts last
      case 'orders':
        return e.orderCount ?? -Infinity;
      case 'avgOrder':
        return e.avgOrder ?? -Infinity;
      case 'marginPercent':
        return e.marginPercent ?? -Infinity;
      case 'frequency':
        return e.frequency ?? -Infinity;
      case 'lastOrder':
        return e.lastOrderDate ? new Date(e.lastOrderDate).getTime() : -Infinity;
      default:
        return e.revenue ?? -Infinity;
    }
  };

  return [...entities].sort((a, b) => {
    const aVal = getValue(a);
    const bVal = getValue(b);
    const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return direction === 'asc' ? cmp : -cmp;
  });
}
