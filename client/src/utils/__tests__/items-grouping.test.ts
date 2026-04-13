// FILE: client/src/utils/__tests__/items-grouping.test.ts
// PURPOSE: Tests for multi-level item grouping, sorting, and aggregation
// USED BY: test runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { groupItems } from '../items-grouping';
import type { FlatItem } from '@shared/types/dashboard';

/** WHY: Shared defaults for new FlatItem fields — tests here only exercise grouping logic */
const PERF_DEFAULTS = { totalUnits: 10, unitName: 'ea' as const, lastPrice: 50, purchaseFrequency: 1, lastOrderDate: '2026-01-01T00:00:00Z', prevYearValue: 0, prevYearMarginPercent: 0, prevYearUnits: 0 };

const ITEMS: FlatItem[] = [
  { name: 'A', sku: 'A1', value: 500, marginPercent: 22, marginAmount: 110, productType: 'Culinary', productFamily: 'Cheese', brand: 'Mitica', countryOfOrigin: 'Italy', foodServiceRetail: 'Food Service', vendor: 'V1', ...PERF_DEFAULTS },
  { name: 'B', sku: 'B1', value: 300, marginPercent: 30, marginAmount: 90, productType: 'Culinary', productFamily: 'Tea', brand: 'DGF', countryOfOrigin: 'France', foodServiceRetail: 'Retail', vendor: 'V2', ...PERF_DEFAULTS },
  { name: 'C', sku: 'C1', value: 200, marginPercent: 40, marginAmount: 80, productType: 'Beverages', productFamily: 'Tea', brand: 'Mitica', countryOfOrigin: 'Italy', foodServiceRetail: 'Food Service', vendor: 'V1', ...PERF_DEFAULTS },
  { name: 'D', sku: 'D1', value: 100, marginPercent: 50, marginAmount: 50, productType: 'Beverages', productFamily: 'Juice', brand: 'Other', countryOfOrigin: 'USA', foodServiceRetail: 'Food Service', vendor: 'V3', ...PERF_DEFAULTS },
];

describe('groupItems', () => {
  it('returns empty array with zero levels', () => {
    expect(groupItems(ITEMS, [], 'value', 'desc')).toEqual([]);
  });

  it('groups by one level', () => {
    const groups = groupItems(ITEMS, ['productType'], 'value', 'desc');
    expect(groups).toHaveLength(2);
    expect(groups[0].label).toBe('Culinary');
    expect(groups[1].label).toBe('Beverages');
  });

  it('groups by two levels', () => {
    const groups = groupItems(ITEMS, ['productType', 'brand'], 'value', 'desc');
    expect(groups[0].label).toBe('Culinary');
    expect(groups[0].children).toHaveLength(2); // Mitica, DGF
  });

  it('groups by three levels', () => {
    const groups = groupItems(ITEMS, ['productType', 'brand', 'countryOfOrigin'], 'value', 'desc');
    const culinary = groups[0];
    expect(culinary.children.length).toBeGreaterThan(0);
    const mitica = culinary.children.find(c => c.label === 'Mitica');
    expect(mitica?.children).toHaveLength(1); // Italy
    expect(mitica?.children[0].items).toHaveLength(1);
  });

  it('computes group value as sum of children', () => {
    const groups = groupItems(ITEMS, ['productType'], 'value', 'desc');
    const culinary = groups.find(g => g.label === 'Culinary')!;
    expect(culinary.totals.value).toBe(800); // 500 + 300
  });

  it('computes group margin as weighted average', () => {
    const groups = groupItems(ITEMS, ['productType'], 'value', 'desc');
    const culinary = groups.find(g => g.label === 'Culinary')!;
    // Weighted: (110 + 90) / (500 + 300) * 100 = 25%
    expect(culinary.totals.marginPercent).toBe(25);
  });

  it('counts leaf items correctly', () => {
    const groups = groupItems(ITEMS, ['productType'], 'value', 'desc');
    const culinary = groups.find(g => g.label === 'Culinary')!;
    expect(culinary.totals.itemCount).toBe(2);
  });

  it('sorts groups by sort field descending', () => {
    const groups = groupItems(ITEMS, ['productType'], 'value', 'desc');
    expect(groups[0].label).toBe('Culinary'); // 800 > 300
    expect(groups[1].label).toBe('Beverages');
  });

  it('sorts products within deepest group', () => {
    const groups = groupItems(ITEMS, ['productType'], 'value', 'desc');
    const culinary = groups.find(g => g.label === 'Culinary')!;
    expect(culinary.items[0].value).toBe(500);
    expect(culinary.items[1].value).toBe(300);
  });

  it('builds composite keys with pipe separator', () => {
    const groups = groupItems(ITEMS, ['productType', 'brand'], 'value', 'desc');
    const culinary = groups[0];
    expect(culinary.key).toBe('Culinary');
    expect(culinary.children[0].key).toContain('|');
  });

  it('sorts Other group last regardless of sort direction', () => {
    const items: FlatItem[] = [
      { ...ITEMS[0], productType: 'Other', value: 9999 },
      { ...ITEMS[1], productType: 'Culinary', value: 100 },
    ];
    const groups = groupItems(items, ['productType'], 'value', 'desc');
    expect(groups[groups.length - 1].label).toBe('Other');
  });
});
