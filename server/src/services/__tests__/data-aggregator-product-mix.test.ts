// FILE: server/src/services/__tests__/data-aggregator-product-mix.test.ts
// PURPOSE: Tests for computeProductMix cap — max 15 segments, Other grouping
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { aggregateOrders } from '../data-aggregator.js';
import type { RawOrder, RawOrderItem } from '../priority-queries.js';

function makeItem(category: string, value: number): RawOrderItem {
  return {
    PARTNAME: `SKU-${category}`,
    PDES: category,
    QPRICE: value,
    QPROFIT: value * 0.2,
    TQUANT: 1,
    TUNITNAME: 'units',
    PRICE: value,
    PERCENT: 20,
    Y_3021_5_ESH: category,
    Y_2075_5_ESH: '',
    Y_9952_5_ESH: '',
    Y_5380_5_ESH: '',
    Y_9967_5_ESH: '',
    Y_1530_5_ESH: '',
    Y_1159_5_ESH: '',
    Y_3020_5_ESH: '',
  } as RawOrderItem;
}

function makeOrder(items: RawOrderItem[]): RawOrder {
  const total = items.reduce((s, i) => s + i.QPRICE, 0);
  return {
    ORDNAME: 'ORD-MIX',
    CURDATE: '2026-01-15T00:00:00Z',
    ORDSTATUSDES: 'Closed',
    TOTPRICE: total,
    CUSTNAME: 'C1',
    AGENTCODE: 'A1',
    AGENTNAME: 'Agent 1',
    ORDERITEMS_SUBFORM: items,
  } as RawOrder;
}

describe('computeProductMix via aggregateOrders', () => {
  it('returns all segments when there are exactly 15 categories', () => {
    const items = Array.from({ length: 15 }, (_, i) =>
      makeItem(`Cat${i + 1}`, 100),
    );
    const result = aggregateOrders([makeOrder(items)], [], 'ytd');
    expect(result.productMixes.productType).toHaveLength(15);
    expect(result.productMixes.productType.every(s => s.category !== 'Other')).toBe(true);
  });

  it('caps at 15 segments and creates Other when there are 16 categories', () => {
    const items = Array.from({ length: 16 }, (_, i) =>
      makeItem(`Cat${i + 1}`, 100),
    );
    const result = aggregateOrders([makeOrder(items)], [], 'ytd');
    expect(result.productMixes.productType).toHaveLength(15);
    const other = result.productMixes.productType.find(s => s.category === 'Other');
    expect(other).toBeDefined();
  });

  it('Other sums the values of all categories beyond the top 14', () => {
    const items = Array.from({ length: 16 }, (_, i) =>
      makeItem(`Cat${i + 1}`, 100),
    );
    const result = aggregateOrders([makeOrder(items)], [], 'ytd');
    const other = result.productMixes.productType.find(s => s.category === 'Other');
    // 16 categories × $100 each — top 14 named, Other = 2 × $100 = $200
    expect(other?.value).toBe(200);
  });

  it('returns fewer than 15 segments without Other when data has fewer categories', () => {
    const items = [
      makeItem('Bread', 500),
      makeItem('Dairy', 300),
    ];
    const result = aggregateOrders([makeOrder(items)], [], 'ytd');
    expect(result.productMixes.productType).toHaveLength(2);
    expect(result.productMixes.productType.every(s => s.category !== 'Other')).toBe(true);
  });
});
