// FILE: server/src/services/__tests__/data-aggregator-consolidated.test.ts
// PURPOSE: Tests for aggregateOrders opts parameter — consolidated mode output
// USED BY: vitest runner
// EXPORTS: none

import { describe, it, expect } from 'vitest';
import { aggregateOrders } from '../data-aggregator.js';
import type { RawOrder, RawOrderItem, RawCustomer } from '../priority-queries.js';

function makeOrder(overrides: Partial<RawOrder>): RawOrder {
  return {
    ORDNAME: 'ORD-1',
    CURDATE: '2026-01-15T00:00:00Z',
    ORDSTATUSDES: 'Closed',
    TOTPRICE: 1000,
    CUSTNAME: 'C1',
    AGENTCODE: 'A1',
    AGENTNAME: 'Agent 1',
    ORDERITEMS_SUBFORM: [],
    ...overrides,
  } as RawOrder;
}

function makeCustomer(name: string, desc: string): RawCustomer {
  return {
    CUSTNAME: name,
    CUSTDES: desc,
    ZONECODE: 'Z1',
    ZONEDES: 'Zone 1',
    AGENTCODE: 'A1',
    AGENTNAME: 'Agent 1',
    CREATEDDATE: '2025-01-01T00:00:00Z',
    CTYPECODE: 'T1',
    CTYPENAME: 'Retail',
  } as RawCustomer;
}

describe('aggregateOrders with preserveEntityIdentity', () => {
  it('populates customerName on OrderRow when opts.preserveEntityIdentity=true', () => {
    const orders = [
      makeOrder({ ORDNAME: 'ORD-1', CUSTNAME: 'C1', TOTPRICE: 100 }),
      makeOrder({ ORDNAME: 'ORD-2', CUSTNAME: 'C2', TOTPRICE: 200 }),
    ];
    const customers = [
      makeCustomer('C1', 'Disney Parks'),
      makeCustomer('C2', 'Disney Cruise'),
    ];

    const result = aggregateOrders(orders, [], 'ytd', {
      preserveEntityIdentity: true,
      customers,
    });

    expect(result.orders).toHaveLength(2);
    expect(result.orders[0].customerName).toBe('Disney Parks');
    expect(result.orders[1].customerName).toBe('Disney Cruise');
  });

  it('omits customerName on OrderRow when opts not provided (v1 compatibility)', () => {
    const orders = [makeOrder({ ORDNAME: 'ORD-1', CUSTNAME: 'C1', TOTPRICE: 100 })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.orders[0].customerName).toBeUndefined();
  });

  it('falls back to CUSTNAME when customer lookup misses', () => {
    const orders = [makeOrder({ ORDNAME: 'ORD-1', CUSTNAME: 'C_UNKNOWN', TOTPRICE: 100 })];
    const result = aggregateOrders(orders, [], 'ytd', {
      preserveEntityIdentity: true,
      customers: [],
    });
    expect(result.orders[0].customerName).toBe('C_UNKNOWN');
  });
});

describe('aggregateOrders with scope option', () => {
  function makeItem(partname: string, brand: string, qprice: number, qprofit = 0, tquant = 1): RawOrderItem {
    return {
      PARTNAME: partname,
      PDES: `Desc ${partname}`,
      TQUANT: tquant,
      TUNITNAME: 'cs',
      PRICE: qprice,
      PURCHASEPRICE: 0,
      QPRICE: qprice,
      QPROFIT: qprofit,
      PERCENT: 0,
      Y_1159_5_ESH: 'Vendor V',
      Y_1530_5_ESH: 'Vendor V',
      Y_9952_5_ESH: brand,
      Y_3020_5_ESH: '',
      Y_3021_5_ESH: 'Type A',
      Y_17936_5_ESH: '',
      Y_2075_5_ESH: 'Family X',
      Y_5380_5_ESH: 'USA',
      Y_9967_5_ESH: 'N',
    } as RawOrderItem;
  }

  it('computes perEntityProductMixes when scope dimension is customer', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C1', TOTPRICE: 100, ORDERITEMS_SUBFORM: [makeItem('SKU-A', 'Brand X', 100)] }),
      makeOrder({ ORDNAME: 'O2', CUSTNAME: 'C2', TOTPRICE: 200, ORDERITEMS_SUBFORM: [makeItem('SKU-B', 'Brand Y', 200)] }),
    ];
    const customers = [makeCustomer('C1', 'Disney Parks'), makeCustomer('C2', 'Disney Cruise')];

    const result = aggregateOrders(orders, [], 'ytd', {
      customers,
      scope: { dimension: 'customer', entityIds: ['C1', 'C2'] },
    });

    expect(result.perEntityProductMixes).toBeDefined();
    expect(result.perEntityProductMixes!['C1']).toBeDefined();
    expect(result.perEntityProductMixes!['C1'].brand).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: 'Brand X', value: 100 })]),
    );
    expect(result.perEntityProductMixes!['C2'].brand).toEqual(
      expect.arrayContaining([expect.objectContaining({ category: 'Brand Y', value: 200 })]),
    );
  });

  it('computes perEntityTopSellers when scope dimension is customer', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C1', TOTPRICE: 100, ORDERITEMS_SUBFORM: [makeItem('SKU-A', 'Brand X', 100, 0, 5)] }),
      makeOrder({ ORDNAME: 'O2', CUSTNAME: 'C1', TOTPRICE: 50, ORDERITEMS_SUBFORM: [makeItem('SKU-B', 'Brand X', 50, 0, 2)] }),
      makeOrder({ ORDNAME: 'O3', CUSTNAME: 'C2', TOTPRICE: 300, ORDERITEMS_SUBFORM: [makeItem('SKU-C', 'Brand Y', 300, 0, 10)] }),
    ];
    const customers = [makeCustomer('C1', 'Disney Parks'), makeCustomer('C2', 'Disney Cruise')];

    const result = aggregateOrders(orders, [], 'ytd', {
      customers,
      scope: { dimension: 'customer', entityIds: ['C1', 'C2'] },
    });

    expect(result.perEntityTopSellers).toBeDefined();
    expect(result.perEntityTopSellers!['C1']).toHaveLength(2);
    expect(result.perEntityTopSellers!['C1'][0].sku).toBe('SKU-A'); // higher revenue first
    expect(result.perEntityTopSellers!['C2']).toHaveLength(1);
    expect(result.perEntityTopSellers!['C2'][0].sku).toBe('SKU-C');
  });

  it('computes perEntityMonthlyRevenue when scope dimension is customer', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C1', CURDATE: '2026-01-15T00:00:00Z', TOTPRICE: 100 }),
      makeOrder({ ORDNAME: 'O2', CUSTNAME: 'C1', CURDATE: '2026-02-15T00:00:00Z', TOTPRICE: 200 }),
      makeOrder({ ORDNAME: 'O3', CUSTNAME: 'C2', CURDATE: '2026-01-15T00:00:00Z', TOTPRICE: 300 }),
    ];
    const customers = [makeCustomer('C1', 'Disney Parks'), makeCustomer('C2', 'Disney Cruise')];

    const result = aggregateOrders(orders, [], 'ytd', {
      customers,
      scope: { dimension: 'customer', entityIds: ['C1', 'C2'] },
    });

    expect(result.perEntityMonthlyRevenue).toBeDefined();
    expect(result.perEntityMonthlyRevenue!['C1']).toBeDefined();
    // WHY: computeMonthlyRevenue uses MONTH_NAMES ("Jan", "Feb"...) and monthIndex (0-11)
    const c1Jan = result.perEntityMonthlyRevenue!['C1'].find(m => m.monthIndex === 0);
    expect(c1Jan?.currentYear).toBe(100);
  });

  it('omits per-entity fields when scope is not provided', () => {
    // WHY: no scope → aggregateOrders returns a simple flat aggregate, no per-entity breakdown
    const orders = [makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C1', TOTPRICE: 100, ORDERITEMS_SUBFORM: [makeItem('SKU-A', 'Brand X', 100)] })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.perEntityProductMixes).toBeUndefined();
    expect(result.perEntityTopSellers).toBeUndefined();
    expect(result.perEntityMonthlyRevenue).toBeUndefined();
  });
});

describe('aggregateOrders scope — Codex #2 fix: per-entity re-scoping for item-based dims', () => {
  function makeItem(partname: string, brand: string, qprice: number, qprofit = 0, tquant = 1): RawOrderItem {
    return {
      PARTNAME: partname,
      PDES: `Desc ${partname}`,
      TQUANT: tquant,
      TUNITNAME: 'cs',
      PRICE: qprice,
      PURCHASEPRICE: 0,
      QPRICE: qprice,
      QPROFIT: qprofit,
      PERCENT: 0,
      Y_1159_5_ESH: 'Vendor V',
      Y_1530_5_ESH: 'Vendor V',
      Y_9952_5_ESH: brand,
      Y_3020_5_ESH: '',
      Y_3021_5_ESH: 'Type A',
      Y_17936_5_ESH: '',
      Y_2075_5_ESH: 'Family X',
      Y_5380_5_ESH: 'USA',
      Y_9967_5_ESH: 'N',
    } as RawOrderItem;
  }

  it('per-entity revenue reflects only that entity items, not the full order TOTPRICE', () => {
    // One order with items from V1 (100) and V2 (200). Select both vendors.
    const order = makeOrder({
      ORDNAME: 'O1',
      CUSTNAME: 'C1',
      CURDATE: '2026-01-15T00:00:00Z',
      TOTPRICE: 300,
      ORDERITEMS_SUBFORM: [
        { ...makeItem('SKU-A', 'Brand X', 100), Y_1159_5_ESH: 'V1' },
        { ...makeItem('SKU-B', 'Brand Y', 200), Y_1159_5_ESH: 'V2' },
      ],
    });
    const customers = [makeCustomer('C1', 'Test Customer')];
    const result = aggregateOrders([order], [], 'ytd', {
      customers,
      scope: { dimension: 'vendor', entityIds: ['V1', 'V2'] },
    });

    // Each vendor's perEntity monthlyRevenue must reflect only its own items.
    const v1Jan = result.perEntityMonthlyRevenue?.['V1']?.find(m => m.monthIndex === 0);
    const v2Jan = result.perEntityMonthlyRevenue?.['V2']?.find(m => m.monthIndex === 0);
    expect(v1Jan?.currentYear).toBe(100);
    expect(v2Jan?.currentYear).toBe(200);
    // NOT 300 each, which is what the old groupOrdersByDimension approach would give.

    // Also verify global view: TOTPRICE rewritten via scopeOrders to sum of V1+V2 items = 300
    // (happens to match original TOTPRICE here because all items are in scope).
    expect(result.kpis.totalRevenue).toBe(300);
  });

  it('per-entity product mix reflects only that entity items', () => {
    const order = makeOrder({
      ORDNAME: 'O1', CUSTNAME: 'C1', TOTPRICE: 300,
      ORDERITEMS_SUBFORM: [
        { ...makeItem('SKU-A', 'Brand X', 100), Y_1159_5_ESH: 'V1' },
        { ...makeItem('SKU-B', 'Brand Y', 200), Y_1159_5_ESH: 'V2' },
      ],
    });
    const customers = [makeCustomer('C1', 'Test')];
    const result = aggregateOrders([order], [], 'ytd', {
      customers,
      scope: { dimension: 'vendor', entityIds: ['V1', 'V2'] },
    });

    const v1Brands = result.perEntityProductMixes?.['V1']?.brand ?? [];
    const v2Brands = result.perEntityProductMixes?.['V2']?.brand ?? [];
    expect(v1Brands).toEqual(expect.arrayContaining([expect.objectContaining({ category: 'Brand X', value: 100 })]));
    expect(v1Brands.find(s => s.category === 'Brand Y')).toBeUndefined();
    expect(v2Brands).toEqual(expect.arrayContaining([expect.objectContaining({ category: 'Brand Y', value: 200 })]));
    expect(v2Brands.find(s => s.category === 'Brand X')).toBeUndefined();
  });

  it('entityIds.length === 1 → does NOT populate perEntity fields (single-entity view has no "per-entity" concept)', () => {
    const order = makeOrder({
      ORDNAME: 'O1', CUSTNAME: 'C1', TOTPRICE: 100,
      ORDERITEMS_SUBFORM: [{ ...makeItem('SKU-A', 'Brand X', 100), Y_1159_5_ESH: 'V1' }],
    });
    const customers = [makeCustomer('C1', 'Test')];
    const result = aggregateOrders([order], [], 'ytd', {
      customers,
      scope: { dimension: 'vendor', entityIds: ['V1'] },
    });

    expect(result.perEntityProductMixes).toBeUndefined();
    expect(result.perEntityTopSellers).toBeUndefined();
    expect(result.perEntityMonthlyRevenue).toBeUndefined();
    // Global view should still be scoped to V1 (here all items are V1, so same total).
    expect(result.kpis.totalRevenue).toBe(100);
  });
});
