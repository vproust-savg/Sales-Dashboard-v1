// FILE: client/src/utils/__tests__/items-filter.test.ts
// PURPOSE: Tests for item chip filter (AND across fields, OR within field)
// USED BY: test runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { filterItems } from '../items-filter';
import type { FlatItem } from '@shared/types/dashboard';

/** WHY: Shared defaults for new FlatItem fields — tests here only exercise filter logic */
const PERF_DEFAULTS = { totalUnits: 10, unitName: 'ea' as const, lastPrice: 50, purchaseFrequency: 1, lastOrderDate: '2026-01-01T00:00:00Z', prevYearValue: 0, prevYearMarginPercent: 0, prevYearUnits: 0 };

const ITEMS: FlatItem[] = [
  { name: 'Product A', sku: 'A1', value: 500, marginPercent: 22, marginAmount: 110, productType: 'Culinary', productFamily: 'Cheese', brand: 'Mitica', countryOfOrigin: 'Italy', foodServiceRetail: 'Food Service', vendor: 'V1', ...PERF_DEFAULTS },
  { name: 'Product B', sku: 'B1', value: 300, marginPercent: 30, marginAmount: 90, productType: 'Culinary', productFamily: 'Tea', brand: 'DGF', countryOfOrigin: 'France', foodServiceRetail: 'Retail', vendor: 'V2', ...PERF_DEFAULTS },
  { name: 'Product C', sku: 'C1', value: 200, marginPercent: 40, marginAmount: 80, productType: 'Beverages', productFamily: 'Tea', brand: 'Mitica', countryOfOrigin: 'Italy', foodServiceRetail: 'Food Service', vendor: 'V1', ...PERF_DEFAULTS },
];

describe('filterItems', () => {
  it('returns all items with empty filters', () => {
    expect(filterItems(ITEMS, {})).toEqual(ITEMS);
  });

  it('filters by single field single value', () => {
    const result = filterItems(ITEMS, { productType: ['Culinary'] });
    expect(result).toHaveLength(2);
    expect(result.every(i => i.productType === 'Culinary')).toBe(true);
  });

  it('OR within same field', () => {
    const result = filterItems(ITEMS, { brand: ['Mitica', 'DGF'] });
    expect(result).toHaveLength(3);
  });

  it('AND across different fields', () => {
    const result = filterItems(ITEMS, { productType: ['Culinary'], brand: ['Mitica'] });
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('A1');
  });

  it('ignores fields with empty arrays', () => {
    const result = filterItems(ITEMS, { productType: [], brand: ['Mitica'] });
    expect(result).toHaveLength(2);
  });
});
