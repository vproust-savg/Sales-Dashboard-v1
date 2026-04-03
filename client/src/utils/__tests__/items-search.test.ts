// FILE: client/src/utils/__tests__/items-search.test.ts
// PURPOSE: Tests for item search (name + SKU substring match)
// USED BY: test runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { searchItems } from '../items-search';
import type { FlatItem } from '@shared/types/dashboard';

const ITEMS: FlatItem[] = [
  { name: 'MITICA Parmigiano Reggiano', sku: '10914', value: 500, marginPercent: 22, marginAmount: 110, productType: 'Culinary', productFamily: 'Cheese', brand: 'Mitica', countryOfOrigin: 'Italy', foodServiceRetail: 'Food Service', vendor: 'Vendor A' },
  { name: 'TEA FORTE Green Mango', sku: '11829', value: 71, marginPercent: 36, marginAmount: 26, productType: 'Beverages', productFamily: 'Tea', brand: 'Tea Forte', countryOfOrigin: 'USA', foodServiceRetail: 'Retail', vendor: 'Vendor B' },
  { name: 'DGF Apricot in Liqueur', sku: '10334', value: 126, marginPercent: 28, marginAmount: 35, productType: 'Pastry', productFamily: 'Fruits', brand: 'DGF', countryOfOrigin: 'France', foodServiceRetail: 'Food Service', vendor: 'Vendor C' },
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
