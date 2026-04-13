// FILE: client/src/utils/__tests__/items-search.test.ts
// PURPOSE: Tests for item search (name + SKU substring match)
// USED BY: test runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { searchItems } from '../items-search';
import type { FlatItem } from '@shared/types/dashboard';

/** WHY: Shared defaults for new FlatItem fields — tests here only exercise search logic */
const PERF_DEFAULTS = { totalUnits: 10, unitName: 'ea' as const, lastPrice: 50, purchaseFrequency: 1, lastOrderDate: '2026-01-01T00:00:00Z', prevYearValue: 0, prevYearMarginPercent: 0, prevYearUnits: 0 };

const ITEMS: FlatItem[] = [
  { name: 'MITICA Parmigiano Reggiano', sku: '10914', value: 500, marginPercent: 22, marginAmount: 110, productType: 'Culinary', productFamily: 'Cheese', brand: 'Mitica', countryOfOrigin: 'Italy', foodServiceRetail: 'Food Service', vendor: 'Vendor A', ...PERF_DEFAULTS },
  { name: 'TEA FORTE Green Mango', sku: '11829', value: 71, marginPercent: 36, marginAmount: 26, productType: 'Beverages', productFamily: 'Tea', brand: 'Tea Forte', countryOfOrigin: 'USA', foodServiceRetail: 'Retail', vendor: 'Vendor B', ...PERF_DEFAULTS },
  { name: 'DGF Apricot in Liqueur', sku: '10334', value: 126, marginPercent: 28, marginAmount: 35, productType: 'Pastry', productFamily: 'Fruits', brand: 'DGF', countryOfOrigin: 'France', foodServiceRetail: 'Food Service', vendor: 'Vendor C', ...PERF_DEFAULTS },
];

describe('searchItems', () => {
  it('returns all items for empty search', () => {
    expect(searchItems(ITEMS, '')).toEqual(ITEMS);
  });

  it('matches product name case-insensitively', () => {
    const result = searchItems(ITEMS, 'mitica');
    expect(result).toHaveLength(1);
    expect(result[0].sku).toBe('10914');
  });

  it('matches SKU', () => {
    const result = searchItems(ITEMS, '10334');
    expect(result).toHaveLength(1);
    expect(result[0].name).toContain('DGF');
  });

  it('returns empty array when nothing matches', () => {
    expect(searchItems(ITEMS, 'zzzzz')).toEqual([]);
  });
});
