// FILE: server/tests/services/data-aggregator.test.ts
import { describe, it, expect } from 'vitest';
import { aggregateOrders } from '../../src/services/data-aggregator';
import type { RawOrder } from '../../src/services/priority-queries';

function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    ORDNAME: 'ORD-001',
    CURDATE: '2026-02-15T00:00:00Z',
    ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000,
    CUSTNAME: 'C001',
    CUSTDES: 'Acme Corp',
    AGENTCODE: 'A01',
    AGENTDES: 'Sarah M.',
    ORDERITEMS_SUBFORM: [{
      PARTDES: 'Widget A', PARTNAME: 'WGT-A', TQUANT: 100, TUNITNAME: 'ea',
      QPRICE: 5000, PRICE: 50, PURCHASEPRICE: 30, COST: 30,
      QPROFIT: 2000, PERCENT: 0,
      Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One',
      Y_9952_5_ESH: 'BrandX', Y_3020_5_ESH: 'FAM1',
      Y_3021_5_ESH: 'Packaging', Y_17936_5_ESH: 'VP-001',
      Y_2075_5_ESH: 'Family A', Y_5380_5_ESH: 'USA',
      Y_9967_5_ESH: 'N',
    }],
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
        { ...makeOrder().ORDERITEMS_SUBFORM[0], QPROFIT: 2000, QPRICE: 5000 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], QPROFIT: 1000, QPRICE: 3000 },
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
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_3021_5_ESH: 'Packaging', QPRICE: 6000 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_3021_5_ESH: 'Equipment', QPRICE: 4000 },
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.productMixes.productType).toHaveLength(2);
    expect(result.productMixes.productType[0].category).toBe('Packaging');
    expect(result.productMixes.productType[0].percentage).toBe(60);
  });

  it('builds top 25 sellers ranked by revenue', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({
      ...makeOrder().ORDERITEMS_SUBFORM[0],
      PARTNAME: `SKU-${i}`,
      PARTDES: `Product ${i}`,
      QPRICE: (30 - i) * 1000,
      TQUANT: (30 - i) * 10,
    }));
    const orders = [makeOrder({ ORDERITEMS_SUBFORM: items })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.topSellers).toHaveLength(25);
    expect(result.topSellers[0].rank).toBe(1);
    expect(result.topSellers[0].revenue).toBe(30000);
    expect(result.topSellers[24].rank).toBe(25);
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

  it('maps order statuses to dashboard labels', () => {
    const orders = [
      makeOrder({ ORDNAME: 'O1', ORDSTATUSDES: 'Closed' }),
      makeOrder({ ORDNAME: 'O2', ORDSTATUSDES: 'Open' }),
      makeOrder({ ORDNAME: 'O3', ORDSTATUSDES: 'Partially Filled' }),
    ];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.orders[0].status).toBe('Delivered');
    expect(result.orders[1].status).toBe('Processing');
    expect(result.orders[2].status).toBe('Pending');
  });

  it('builds Food Service vs Retail mix from Y_9967_5_ESH', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_9967_5_ESH: 'Y', QPRICE: 7000 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_9967_5_ESH: 'N', QPRICE: 3000 },
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
        { ...makeOrder().ORDERITEMS_SUBFORM[0], PARTNAME: 'SKU-A', TUNITNAME: 'cs', QPRICE: 5000 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], PARTNAME: 'SKU-B', TUNITNAME: 'lb', QPRICE: 3000 },
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.topSellers[0].unit).toBe('cs');
    expect(result.topSellers[1].unit).toBe('lb');
  });

  it('defaults unit to "units" when TUNITNAME is empty', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        { ...makeOrder().ORDERITEMS_SUBFORM[0], TUNITNAME: '' },
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.topSellers[0].unit).toBe('units');
  });

  it('excludes zero-revenue items from top sellers', () => {
    const orders = [makeOrder({
      ORDERITEMS_SUBFORM: [
        { ...makeOrder().ORDERITEMS_SUBFORM[0], PARTNAME: 'SKU-A', QPRICE: 5000 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], PARTNAME: 'SKU-B', QPRICE: 0 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], PARTNAME: 'SKU-C', QPRICE: -100 },
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
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_3021_5_ESH: 'Packaging', QPRICE: 5000 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_3021_5_ESH: 'Equipment', QPRICE: 0 },
        { ...makeOrder().ORDERITEMS_SUBFORM[0], Y_3021_5_ESH: 'Consumables', QPRICE: -100 },
      ],
    })];
    const result = aggregateOrders(orders, [], 'ytd');
    expect(result.productMixes.productType).toHaveLength(1);
    expect(result.productMixes.productType[0].category).toBe('Packaging');
  });
});
