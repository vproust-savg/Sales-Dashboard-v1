// FILE: client/src/utils/filter-engine.ts
// PURPOSE: Client-side filter condition evaluation on entity list
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: filterEntities

import type { EntityListItem } from '@shared/types/dashboard';
import type { FilterCondition } from '../hooks/useFilters';

/** Apply active filter conditions to entity list — spec Section 13.3 */
export function filterEntities(
  entities: EntityListItem[],
  conditions: FilterCondition[],
): EntityListItem[] {
  const activeConditions = conditions.filter(
    c => c.field && c.operator && c.value !== '',
  );
  if (activeConditions.length === 0) return entities;

  return entities.filter(entity =>
    activeConditions.every(cond => evaluateCondition(entity, cond)),
  );
}

function evaluateCondition(
  entity: EntityListItem,
  cond: FilterCondition,
): boolean {
  const fieldValue = getFieldValue(entity, cond.field);
  const condValue =
    typeof cond.value === 'string'
      ? parseFloat(cond.value) || cond.value
      : cond.value;

  switch (cond.operator) {
    case '>':
      return typeof fieldValue === 'number' && fieldValue > (condValue as number);
    case '<':
      return typeof fieldValue === 'number' && fieldValue < (condValue as number);
    case '>=':
      return typeof fieldValue === 'number' && fieldValue >= (condValue as number);
    case '<=':
      return typeof fieldValue === 'number' && fieldValue <= (condValue as number);
    case 'equals':
      return String(fieldValue).toLowerCase() === String(condValue).toLowerCase();
    case 'not equals':
      return String(fieldValue).toLowerCase() !== String(condValue).toLowerCase();
    default:
      return true;
  }
}

/** Map human-readable field names to entity properties */
function getFieldValue(
  entity: EntityListItem,
  field: string,
): number | string {
  const map: Record<string, number | string> = {
    'Total Revenue': entity.revenue,
    'Orders': entity.orderCount,
    'Name': entity.name,
  };
  return map[field] ?? 0;
}
