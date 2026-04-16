// FILE: client/src/utils/filter-types.ts
// PURPOSE: Single source of truth for filter field names, operators, and type classifications
// USED BY: filter-engine.ts, FilterCondition.tsx, FilterPanel.tsx, useFilters.ts
// EXPORTS: FilterField, FilterOperator, FieldType, FIELD_LABELS, OPERATOR_LABELS, FIELD_TYPES, OPERATORS_BY_TYPE, DIMENSION_FILTER_FIELDS

import type { Dimension } from '@shared/types/dashboard';

/** Internal field keys matching EntityListItem property names */
export type FilterField =
  | 'revenue' | 'orderCount' | 'avgOrder' | 'marginPercent'
  | 'frequency' | 'lastOrderDate'
  | 'name' | 'rep' | 'zone' | 'customerType'
  | 'brand' | 'productFamily' | 'countryOfOrigin' | 'foodServiceRetail';  // item-level attributes

export type FilterOperator =
  | 'gt' | 'lt' | 'gte' | 'lte'
  | 'equals' | 'not_equals' | 'contains'
  | 'between' | 'is_before' | 'is_after' | 'is_empty';

export type FieldType = 'numeric' | 'date' | 'text';

/** Human-readable labels shown in filter field dropdown */
export const FIELD_LABELS: Record<FilterField, string> = {
  revenue: 'Revenue', orderCount: 'Orders', avgOrder: 'Avg Order',
  marginPercent: 'Margin %', frequency: 'Frequency',
  lastOrderDate: 'Last Order',
  name: 'Name', rep: 'Rep', zone: 'Zone', customerType: 'Customer Type',
  brand: 'Brand', productFamily: 'Product Family',
  countryOfOrigin: 'Country of Origin', foodServiceRetail: 'FS vs Retail',
};

/** Human-readable labels shown in operator dropdown */
export const OPERATOR_LABELS: Record<FilterOperator, string> = {
  gt: '>', lt: '<', gte: '>=', lte: '<=',
  equals: 'equals', not_equals: 'not equals',
  contains: 'contains', between: 'between',
  is_before: 'is before', is_after: 'is after',
  is_empty: 'is empty',
};

/** WHY: Different field types support different operators — spec Section 22.7 */
export const FIELD_TYPES: Record<FilterField, FieldType> = {
  revenue: 'numeric', orderCount: 'numeric', avgOrder: 'numeric',
  marginPercent: 'numeric', frequency: 'numeric',
  lastOrderDate: 'date',
  name: 'text', rep: 'text', zone: 'text', customerType: 'text',
  brand: 'text', productFamily: 'text',
  countryOfOrigin: 'text', foodServiceRetail: 'text',
};

/** Operators available per field type */
export const OPERATORS_BY_TYPE: Record<FieldType, FilterOperator[]> = {
  numeric: ['gt', 'lt', 'gte', 'lte', 'equals', 'between', 'is_empty'],
  date: ['is_before', 'is_after', 'between', 'is_empty'],
  text: ['equals', 'not_equals', 'contains', 'is_empty'],
};

/** Fields that require "All" data to be loaded before they can be used for filtering/sorting */
export const METRIC_FILTER_FIELDS: Set<FilterField> = new Set([
  'revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency',
]);

/** WHY: Not all fields exist on all dimensions — rep/zone/customerType only on customers;
 *  brand/productFamily/countryOfOrigin/foodServiceRetail only on item-level dims. */
export const DIMENSION_FILTER_FIELDS: Record<Dimension, FilterField[]> = {
  customer:     ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name', 'rep', 'zone', 'customerType'],
  zone:         ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
  vendor:       ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name', 'brand', 'productFamily', 'countryOfOrigin', 'foodServiceRetail'],
  brand:        ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name'],
  product_type: ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name', 'brand', 'countryOfOrigin', 'foodServiceRetail'],
  product:      ['revenue', 'orderCount', 'avgOrder', 'marginPercent', 'frequency', 'lastOrderDate', 'name', 'brand', 'productFamily', 'countryOfOrigin', 'foodServiceRetail'],
};
