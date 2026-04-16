// FILE: client/src/utils/filter-engine.ts
// PURPOSE: Client-side filter condition evaluation on enriched entity list
// USED BY: client/src/hooks/useDashboardState.ts
// EXPORTS: filterEntities, FilterCondition

import type { EntityListItem } from '@shared/types/dashboard';
import type { FilterField, FilterOperator } from './filter-types';

export interface FilterCondition {
  id: string;
  field: FilterField;
  operator: FilterOperator;
  value: string | number;
  conjunction: 'and' | 'or';
}

/** Apply active filter conditions to entity list — spec Section 13.3 */
export function filterEntities(
  entities: EntityListItem[],
  conditions: FilterCondition[],
): EntityListItem[] {
  const active = conditions.filter(c => c.field && c.operator && c.value !== '');
  if (active.length === 0) return entities;

  return entities.filter(entity => {
    let result = evaluateCondition(entity, active[0]);
    for (let i = 1; i < active.length; i++) {
      const matches = evaluateCondition(entity, active[i]);
      result = active[i].conjunction === 'or'
        ? result || matches
        : result && matches;
    }
    return result;
  });
}

function evaluateCondition(entity: EntityListItem, cond: FilterCondition): boolean {
  const fieldValue = getFieldValue(entity, cond.field);
  if (cond.operator === 'is_empty') {
    return fieldValue === null || fieldValue === undefined || fieldValue === '';
  }

  const condValue = typeof cond.value === 'string' ? parseFloat(cond.value) || cond.value : cond.value;

  switch (cond.operator) {
    case 'gt':
      return typeof fieldValue === 'number' && fieldValue > (condValue as number);
    case 'lt':
      return typeof fieldValue === 'number' && fieldValue < (condValue as number);
    case 'gte':
      return typeof fieldValue === 'number' && fieldValue >= (condValue as number);
    case 'lte':
      return typeof fieldValue === 'number' && fieldValue <= (condValue as number);
    case 'equals':
      return String(fieldValue).toLowerCase() === String(condValue).toLowerCase();
    case 'not_equals':
      return String(fieldValue).toLowerCase() !== String(condValue).toLowerCase();
    case 'contains':
      return String(fieldValue).toLowerCase().includes(String(condValue).toLowerCase());
    case 'is_before':
      return fieldValue !== null && new Date(String(fieldValue)) < new Date(String(condValue));
    case 'is_after':
      return fieldValue !== null && new Date(String(fieldValue)) > new Date(String(condValue));
    case 'between': {
      const parts = String(condValue).split(',');
      if (parts.length !== 2) return true;
      const [min, max] = parts.map(s => parseFloat(s.trim()));
      return typeof fieldValue === 'number' && fieldValue >= min && fieldValue <= max;
    }
    default:
      return true;
  }
}

/** WHY: Direct property access from enriched EntityListItem — no label translation needed.
 *  Item-level attributes (brand, productFamily, etc.) are not on EntityListItem — return null
 *  so is_empty / contains operators still work via the null path in evaluateCondition. */
function getFieldValue(entity: EntityListItem, field: FilterField): number | string | null {
  const map: Record<FilterField, number | string | null> = {
    revenue: entity.revenue,
    orderCount: entity.orderCount,
    avgOrder: entity.avgOrder,
    marginPercent: entity.marginPercent,
    frequency: entity.frequency,
    lastOrderDate: entity.lastOrderDate,
    name: entity.name,
    rep: entity.rep,
    zone: entity.zone,
    customerType: entity.customerType,
    // WHY: Item-level attributes are not stored on EntityListItem — these fields are used
    // by the Report filter dialog (FetchAllFilters), not client-side list filtering.
    brand: null,
    productFamily: null,
    countryOfOrigin: null,
    foodServiceRetail: null,
  };
  return map[field] ?? null;
}
