// FILE: server/tests/services/data-aggregator.test.ts
import { describe, it, expect } from 'vitest';
import { aggregateOrders } from '../../src/services/data-aggregator';
import type { RawOrder, RawOrderItem } from '../../src/services/priority-queries';

function makeItem(overrides: Partial<RawOrderItem> = {}): RawOrderItem {
  return {
    PDES: 'Widget A',
    PARTNAME: 'WGT-A',
    TQUANT: 100,
    TUNITNAME: 'ea',
    QPRICE: 5000,
    PRICE: 50,
    PURCHASEPRICE: 30,
    QPROFIT: 2000,
    PERCENT: 40,
    Y_1159_5_ESH: 'V01',
    Y_1530_5_ESH: 'Vendor One',
    Y_9952_5_ESH: 'BrandX',
    Y_3020_5_ESH: 'FAM1',
    Y_3021_5_ESH: 'Packaging',
    Y_17936_5_ESH: 'VP-001',
    Y_2075_5_ESH: 'Family A',
    Y_5380_5_ESH: 'USA',
    Y_9967_5_ESH: 'N',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    ORDNAME: 'ORD-001',
    CURDATE: '2026-02-15T00:00:00Z',
    ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000,
    CUSTNAME: 'C001',
    AGENTCODE: 'A01',
    AGENTNAME: 'Sarah M.',
    ORDERITEMS_SUBFORM: [makeItem()],
    ...overrides,
  };
}

describe('aggregateOrders', () => {
  it('computes total revenue as SUM of TOTPRICE', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', TOTPRICE: 10000 }),
      makeOrder({ ORDNAME: 'O2', TOTPRICE: 5000 }),
    ];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.kpis.totalRevenue).toBe(15000);
  });

  it('computes order count', () => {
    const orders = [makeOrder({ ORDNAME: 'O1' }), makeOrder({ ORDNAME: 'O2' })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.kpis.orders).toBe(2);
  });

  it('computes avgOrder as revenue / orders', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', TOTPRICE: 10000 }),
      makeOrder({ ORDNAME: 'O2', TOTPRICE: 5000 }),
    ];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.kpis.avgOrder).toBe(7500);
  });

  it('returns null avgOrder when 0 orders', () => {
    const result = aggregateOrders([], [], 'ytd');
    expect(result.kpis.avgOrder).toBeNull();
  });

  it('computes margin from SUM of QPROFIT', () => {
    const orders = [makeOrder({
      ORDNAME: 'O1',
      ORDERITEMS_SUBFORM: [
        makeItem({ QPROFIT: 2000, QPRICE: 5000 }),
        makeItem({ QPROFIT: 1000, QPRICE: 3000 }),
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.kpis.marginAmount).toBe(3000);
    expect(result.kpis.marginPercent).toBeCloseTo(37.5); // 3000/8000 * 100
  });

  it('builds monthly revenue array with 12 months', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', CURDATE: '2026-01-15T00:00:00Z', TOTPRICE: 1000 }),
      makeOrder({ ORDNAME: 'O2', CURDATE: '2026-01-20T00:00:00Z', TOTPRICE: 2000 }),
      makeOrder({ ORDNAME: 'O3', CURDATE: '2026-03-10T00:00:00Z', TOTPRICE: 3000 }),
    ];
    const prevOrders = [
      makeOrder({ ORDNAME: 'P1', CURDATE: '2025-01-15T00:00:00Z', TOTPRICE: 800 }),
    ];
    const result = aggregateOrders(orders, prevOrders, 'ytd');
    expect(result.monthlyRevenue).toHaveLength(12);
    expect(result.monthlyRevenue[0].currentYear).toBe(3000); // Jan
    expect(result.monthlyRevenue[0].previousYear).toBe(800);
    expect(result.monthlyRevenue[2].currentYear).toBe(3000); // Mar
  });

  it('builds product mix from Y_3021_5_ESH (family type name)', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        makeItem({ Y_3021_5_ESH: 'Packaging', QPRICE: 6000 }),
        makeItem({ Y_3021_5_ESH: 'Equipment', QPRICE: 4000 }),
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.productMixes.productType).toHaveLength(2);
    expect(result.productMixes.productType[0].category).toBe('Packaging');
    expect(result.productMixes.productType[0].percentage).toBe(60);
  });

  it('builds top 100 sellers ranked by revenue (modal slices client-side)', () => {
    const items = Array.from({ length: 30 }, (_, i) =>
      makeItem({
        PARTNAME: `SKU-${i}`,
        PDES: `Product ${i}`,
        QPRICE: (30 - i) * 1000,
        TQUANT: (30 - i) * 10,
      }),
    );
    const orders = [makeOrder({ ORDERITEMS_SUBFORM: items })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.topSellers).toHaveLength(30);
    expect(result.topSellers[0].rank).toBe(1);
    expect(result.topSellers[0].revenue).toBe(30000);
    expect(result.topSellers[29].rank).toBe(30);
  });

  it('excludes SKUs that start with "000" (placeholder freight/discount line items)', () => {
    // Highest revenue is the placeholder; it must not appear in top sellers.
    // Real products keep their relative ranking, ranks are recomputed 1..N.
    const items = [
      makeItem({ PARTNAME: '000-FREIGHT',   PDES: 'Freight charge',  QPRICE: 99999, TQUANT: 1 }),
      makeItem({ PARTNAME: '0001-DISCOUNT', PDES: 'Promo discount',  QPRICE: 88888, TQUANT: 1 }),
      makeItem({ PARTNAME: 'REAL-A',        PDES: 'Real product A',  QPRICE: 5000,  TQUANT: 10 }),
      makeItem({ PARTNAME: 'REAL-B',        PDES: 'Real product B',  QPRICE: 3000,  TQUANT: 5 }),
      // SKUs that contain '000' but don't START with it MUST still be included.
      makeItem({ PARTNAME: '90001',         PDES: 'Real product C',  QPRICE: 2000,  TQUANT: 3 }),
    ];
    const orders = [makeOrder({ ORDERITEMS_SUBFORM: items })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.topSellers).toHaveLength(3);
    expect(result.topSellers.map(s => s.sku)).toEqual(['REAL-A', 'REAL-B', '90001']);
    expect(result.topSellers[0].rank).toBe(1);
    expect(result.topSellers[2].rank).toBe(3);
  });

  it('computes YoY revenue change percent', () => {
    const orders = [makeOrder({ TOTPRICE: 24000 })];
    const prevOrders = [makeOrder({ TOTPRICE: 20000 })];
    const result = aggregateOrders(orders, prevOrders, 'ytd');
    expect(result.kpis.revenueChangePercent).toBeCloseTo(20); // (24000-20000)/20000 * 100
    expect(result.kpis.revenueChangeAmount).toBe(4000);
  });

  it('returns null revenueChangePercent when prev year is 0', () => {
    const orders = [makeOrder({ TOTPRICE: 10000 })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.kpis.revenueChangePercent).toBeNull();
  });

  it('passes Priority ORDSTATUSDES through as status', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', ORDSTATUSDES: 'Closed' }),
      makeOrder({ ORDNAME: 'O2', ORDSTATUSDES: 'Open' }),
      makeOrder({ ORDNAME: 'O3', ORDSTATUSDES: 'Partially Filled' }),
    ];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.orders[0].status).toBe('Closed');
    expect(result.orders[1].status).toBe('Open');
    expect(result.orders[2].status).toBe('Partially Filled');
  });

  it('builds Food Service vs Retail mix from Y_9967_5_ESH', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        makeItem({ Y_9967_5_ESH: 'Y', QPRICE: 7000 }),
        makeItem({ Y_9967_5_ESH: 'N', QPRICE: 3000 }),
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.productMixes.foodServiceRetail).toHaveLength(2);
    expect(result.productMixes.foodServiceRetail[0].category).toBe('Retail');
    expect(result.productMixes.foodServiceRetail[0].percentage).toBe(70);
    expect(result.productMixes.foodServiceRetail[1].category).toBe('Food Service');
  });

  it('includes unit of measure from TUNITNAME in top sellers', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        makeItem({ PARTNAME: 'SKU-A', TUNITNAME: 'cs', QPRICE: 5000 }),
        makeItem({ PARTNAME: 'SKU-B', TUNITNAME: 'lb', QPRICE: 3000 }),
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.topSellers[0].unit).toBe('cs');
    expect(result.topSellers[1].unit).toBe('lb');
  });

  it('defaults unit to "units" when TUNITNAME is empty', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        makeItem({ TUNITNAME: '' }),
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.topSellers[0].unit).toBe('units');
  });

  it('excludes zero-revenue items from top sellers', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        makeItem({ PARTNAME: 'SKU-A', QPRICE: 5000 }),
        makeItem({ PARTNAME: 'SKU-B', QPRICE: 0 }),
        makeItem({ PARTNAME: 'SKU-C', QPRICE: -100 }),
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.topSellers).toHaveLength(1);
    expect(result.topSellers[0].sku).toBe('SKU-A');
  });

  it('returns all 5 product mix types', () => {
    const orders = [makeOrder()];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(Object.keys(result.productMixes)).toEqual([
      'productType', 'productFamily', 'brand', 'countryOfOrigin', 'foodServiceRetail',
    ]);
  });

  it('excludes zero-value segments from product mix', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        makeItem({ Y_3021_5_ESH: 'Packaging', QPRICE: 5000 }),
        makeItem({ Y_3021_5_ESH: 'Equipment', QPRICE: 0 }),
        makeItem({ Y_3021_5_ESH: 'Consumables', QPRICE: -100 }),
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.productMixes.productType).toHaveLength(1);
    expect(result.productMixes.productType[0].category).toBe('Packaging');
  });

  // --- Batch A: Zero-amount filter ---

  it('excludes orders with TOTPRICE === 0 from orders array', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', TOTPRICE: 5000 }),
      makeOrder({ ORDNAME: 'O2', TOTPRICE: 0 }),
      makeOrder({ ORDNAME: 'O3', TOTPRICE: 1000 }),
    ];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.orders).toHaveLength(2);
    expect(result.orders.map(o => o.orderNumber)).not.toContain('O2');
  });

  it('excludes zero-amount orders from KPI order count', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', TOTPRICE: 5000 }),
      makeOrder({ ORDNAME: 'O2', TOTPRICE: 0 }),
    ];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.kpis.orders).toBe(1);
  });

  it('keeps orders with negative TOTPRICE (credit memos)', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', TOTPRICE: -500 }),
    ];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].orderNumber).toBe('O1');
  });

  // --- Batch B: Line items in OrderRow ---

  it('includes line items array on each order row', () => {
    const orders = [makeOrder({
      ORDNAME: 'O1',
      ORDERITEMS_SUBFORM: [
        makeItem({ PARTNAME: 'SKU-A', QPRICE: 3000 }),
        makeItem({ PARTNAME: 'SKU-B', QPRICE: 1000 }),
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.orders[0].items).toHaveLength(2);
  });

  it('maps line item fields to OrderLineItem shape', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        makeItem({
          PDES: 'Olive Oil 1L',
          PARTNAME: 'OIL-1L',
          TQUANT: 24,
          TUNITNAME: 'cs',
          PRICE: 60,
          QPRICE: 1440,
          PERCENT: 28.33,
        }),
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    const item = result.orders[0].items[0];
    expect(item.productName).toBe('Olive Oil 1L');
    expect(item.sku).toBe('OIL-1L');
    expect(item.quantity).toBe(24);
    expect(item.unit).toBe('cs');
    expect(item.unitPrice).toBe(60);
    expect(item.lineTotal).toBe(1440);
    expect(item.marginPercent).toBeCloseTo(28.33);
  });

  it('sorts line items by lineTotal descending', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        makeItem({ PARTNAME: 'SKU-A', QPRICE: 500 }),
        makeItem({ PARTNAME: 'SKU-B', QPRICE: 2000 }),
        makeItem({ PARTNAME: 'SKU-C', QPRICE: 800 }),
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    const skus = result.orders[0].items.map(i => i.sku);
    expect(skus).toEqual(['SKU-B', 'SKU-C', 'SKU-A']);
  });

  it('defaults unit to "units" when TUNITNAME is empty on line item', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [makeItem({ TUNITNAME: '' })],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.orders[0].items[0].unit).toBe('units');
  });

  it('returns empty items array when order has no ORDERITEMS_SUBFORM', () => {
    const orders = [makeOrder({ ORDERITEMS_SUBFORM: [] })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.orders[0].items).toEqual([]);
  });

  // --- buildFlatItems (via aggregateOrders.items) ---

  describe('buildFlatItems (via aggregateOrders.items)', () => {
    it('returns empty array for order with no items', () => {
      const orders = [makeOrder({ ORDERITEMS_SUBFORM: [] })];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items).toEqual([]);
    });

    it('maps single item with all category fields', () => {
      const orders = [makeOrder()];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items).toHaveLength(1);
      const item = result.items[0];
      expect(item.name).toBe('Widget A');
      expect(item.sku).toBe('WGT-A');
      expect(item.value).toBe(5000);
      expect(item.productType).toBe('Packaging');
      expect(item.productFamily).toBe('Family A');
      expect(item.brand).toBe('BrandX');
      expect(item.countryOfOrigin).toBe('USA');
      expect(item.foodServiceRetail).toBe('Food Service');
      expect(item.vendor).toBe('Vendor One');
    });

    it('aggregates same SKU across multiple items', () => {
      const orders = [
        makeOrder({
          ORDNAME: 'O1',
          ORDERITEMS_SUBFORM: [
            makeItem({ PARTNAME: 'WGT-A', QPRICE: 3000, QPROFIT: 1200 }),
            makeItem({ PARTNAME: 'WGT-A', QPRICE: 2000, QPROFIT: 800 }),
          ],
        }),
      ];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].value).toBe(5000);
      expect(result.items[0].marginAmount).toBe(2000);
    });

    it('defaults missing category fields to Other', () => {
      const orders = [makeOrder({
        ORDERITEMS_SUBFORM: [makeItem({ Y_3021_5_ESH: '', Y_9952_5_ESH: '' })],
      })];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].productType).toBe('Other');
      expect(result.items[0].brand).toBe('Other');
    });

    it('maps Y_9967_5_ESH Y to Retail', () => {
      const orders = [makeOrder({
        ORDERITEMS_SUBFORM: [makeItem({ Y_9967_5_ESH: 'Y' })],
      })];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].foodServiceRetail).toBe('Retail');
    });

    it('maps Y_9967_5_ESH non-Y to Food Service', () => {
      const orders = [makeOrder({
        ORDERITEMS_SUBFORM: [makeItem({ Y_9967_5_ESH: 'N' })],
      })];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].foodServiceRetail).toBe('Food Service');
    });

    it('handles zero value without division error', () => {
      const orders = [makeOrder({
        ORDERITEMS_SUBFORM: [makeItem({ QPRICE: 0, QPROFIT: 0 })],
      })];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].marginPercent).toBe(0);
      expect(Number.isFinite(result.items[0].marginPercent)).toBe(true);
    });

    it('produces distinct FlatItems per unique SKU', () => {
      const orders = [makeOrder({
        ORDERITEMS_SUBFORM: [
          makeItem({ PARTNAME: 'A', PDES: 'Alpha' }),
          makeItem({ PARTNAME: 'B', PDES: 'Beta' }),
          makeItem({ PARTNAME: 'A', PDES: 'Alpha' }),
          makeItem({ PARTNAME: 'C', PDES: 'Charlie' }),
          makeItem({ PARTNAME: 'B', PDES: 'Beta' }),
        ],
      })];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items).toHaveLength(3);
    });

    it('computes totalUnits as sum of TQUANT per SKU', () => {
      const orders = [
        makeOrder({
          ORDNAME: 'O1',
          ORDERITEMS_SUBFORM: [
            makeItem({ PARTNAME: 'A', TQUANT: 10, QPRICE: 100 }),
            makeItem({ PARTNAME: 'A', TQUANT: 5, QPRICE: 50 }),
            makeItem({ PARTNAME: 'B', TQUANT: 20, QPRICE: 200 }),
          ],
        }),
      ];
      const result = aggregateOrders(orders, [], 'ytd');
      const itemA = result.items.find(i => i.sku === 'A')!;
      const itemB = result.items.find(i => i.sku === 'B')!;
      expect(itemA.totalUnits).toBe(15);
      expect(itemB.totalUnits).toBe(20);
    });

    it('captures unitName from first item occurrence per SKU', () => {
      const orders = [makeOrder({
        ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', TUNITNAME: 'cs' })],
      })];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].unitName).toBe('cs');
    });

    it('defaults unitName to "units" when TUNITNAME is empty', () => {
      const orders = [makeOrder({
        ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', TUNITNAME: '' })],
      })];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].unitName).toBe('units');
    });

    it('computes lastPrice from the order with the latest CURDATE', () => {
      const orders = [
        makeOrder({ ORDNAME: 'O1', CURDATE: '2026-01-10T00:00:00Z', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', PRICE: 50 })] }),
        makeOrder({ ORDNAME: 'O2', CURDATE: '2026-03-15T00:00:00Z', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', PRICE: 60 })] }),
        makeOrder({ ORDNAME: 'O3', CURDATE: '2026-02-01T00:00:00Z', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', PRICE: 55 })] }),
      ];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].lastPrice).toBe(60);
    });

    it('computes lastOrderDate as the max CURDATE per SKU', () => {
      const orders = [
        makeOrder({ ORDNAME: 'O1', CURDATE: '2026-01-10T00:00:00Z', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A' })] }),
        makeOrder({ ORDNAME: 'O2', CURDATE: '2026-03-15T00:00:00Z', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A' })] }),
      ];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].lastOrderDate).toBe('2026-03-15T00:00:00Z');
    });

    it('computes purchaseFrequency as orderCount / periodMonths', () => {
      const orders = [
        makeOrder({ ORDNAME: 'O1', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A' })] }),
        makeOrder({ ORDNAME: 'O2', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A' })] }),
        makeOrder({ ORDNAME: 'O3', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A' })] }),
      ];
      const result = aggregateOrders(orders, [], 'ytd');
      const expectedMonths = Math.max(1, new Date().getUTCMonth() + 1);
      expect(result.items[0].purchaseFrequency).toBeCloseTo(3 / expectedMonths, 1);
    });

    it('computes prevYearValue as sum of QPRICE from prevOrders per SKU', () => {
      const orders = [makeOrder({ ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', QPRICE: 500 })] })];
      const prevOrders = [
        makeOrder({ ORDNAME: 'P1', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', QPRICE: 300 })] }),
        makeOrder({ ORDNAME: 'P2', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', QPRICE: 200 })] }),
      ];
      const result = aggregateOrders(orders, prevOrders, 'ytd');
      expect(result.items[0].prevYearValue).toBe(500);
    });

    it('computes prevYearMarginPercent from prevOrders', () => {
      const orders = [makeOrder({ ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', QPRICE: 1000, QPROFIT: 400 })] })];
      const prevOrders = [makeOrder({ ORDNAME: 'P1', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', QPRICE: 800, QPROFIT: 200 })] })];
      const result = aggregateOrders(orders, prevOrders, 'ytd');
      expect(result.items[0].prevYearMarginPercent).toBeCloseTo(25);
    });

    it('computes prevYearUnits as sum of TQUANT from prevOrders', () => {
      const orders = [makeOrder({ ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', TQUANT: 50 })] })];
      const prevOrders = [makeOrder({ ORDNAME: 'P1', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A', TQUANT: 30 })] })];
      const result = aggregateOrders(orders, prevOrders, 'ytd');
      expect(result.items[0].prevYearUnits).toBe(30);
    });

    it('returns 0 for prev year fields when SKU not in prevOrders', () => {
      const orders = [makeOrder({ ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'NEW-SKU' })] })];
      const result = aggregateOrders(orders, [], 'ytd');
      expect(result.items[0].prevYearValue).toBe(0);
      expect(result.items[0].prevYearMarginPercent).toBe(0);
      expect(result.items[0].prevYearUnits).toBe(0);
    });

    it('ignores SKUs present only in prevOrders (not in current period)', () => {
      const orders = [makeOrder({ ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'A' })] })];
      const prevOrders = [makeOrder({ ORDNAME: 'P1', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'GONE-SKU' })] })];
      const result = aggregateOrders(orders, prevOrders, 'ytd');
      expect(result.items).toHaveLength(1);
      expect(result.items[0].sku).toBe('A');
    });
  });
});
