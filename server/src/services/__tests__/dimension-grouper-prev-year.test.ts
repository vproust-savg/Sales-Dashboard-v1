// FILE: server/src/services/__tests__/dimension-grouper-prev-year.test.ts
// PURPOSE: TDD guard for the 18 prev-year metric fields wired in groupByDimension (customer + zone + per-item dims)
// USED BY: vitest test suite
// EXPORTS: (test file, no exports)

import { describe, it, expect } from 'vitest';
import { groupByDimension } from '../dimension-grouper.js';
import type { RawOrder, RawCustomer } from '../priority-queries.js';

const CUSTOMERS: RawCustomer[] = [
  {
    CUSTNAME: 'C1', CUSTDES: 'Customer One', ZONECODE: 'Z1', ZONEDES: 'Zone 1',
    AGENTCODE: '', AGENTNAME: '', CREATEDDATE: '', CTYPECODE: '', CTYPENAME: '',
  },
];

// WHY: cost is passed as QPROFIT = total - cost so that QPRICE - QPROFIT = cost.
// RawOrderItem uses QPRICE (line total) and QPROFIT (line profit), not QUANTCOST.
function mkOrder(ordname: string, date: string, total: number, cost: number): RawOrder {
  return {
    ORDNAME: ordname,
    CUSTNAME: 'C1',
    CURDATE: date,
    TOTPRICE: total,
    ORDSTATUSDES: 'Closed',
    AGENTCODE: '',
    AGENTNAME: '',
    ORDERITEMS_SUBFORM: [
      {
        PARTNAME: 'P1',
        PDES: 'Part',
        TQUANT: 1,
        TUNITNAME: 'cs',
        QPRICE: total,
        PRICE: total,
        PURCHASEPRICE: cost,
        QPROFIT: total - cost,
        PERCENT: cost > 0 ? ((total - cost) / total) * 100 : 0,
        Y_1530_5_ESH: 'VendorA',
        Y_1159_5_ESH: 'V1',
        Y_9952_5_ESH: 'BrandA',
        Y_3020_5_ESH: '01',
        Y_3021_5_ESH: 'TypeA',
        Y_17936_5_ESH: '',
        Y_2075_5_ESH: '',
        Y_5380_5_ESH: 'USA',
        Y_9967_5_ESH: 'N',
      },
    ],
  };
}

describe('groupByDimension — per-metric prev-year fields', () => {
  it('populates all 18 prev-year fields for the customer dimension', () => {
    const today = new Date('2026-04-17');

    // Current YTD: 2 orders
    const ordersCurrent = [
      mkOrder('OC1', '2026-02-01', 1000, 600),
      mkOrder('OC2', '2026-03-01', 2000, 1200),
    ];

    // Prev-year same period (2025-01-01 to 2025-04-17): 1 order
    const ordersPrevSame = [
      mkOrder('OP1', '2025-02-15', 500, 300),
    ];

    // Prev-year full (all of 2025): 3 orders
    const ordersPrevFull = [
      mkOrder('OP1', '2025-02-15', 500, 300),
      mkOrder('OP2', '2025-06-10', 800, 500),
      mkOrder('OP3', '2025-11-20', 700, 400),
    ];

    const result = groupByDimension(
      'customer',
      ordersCurrent,
      CUSTOMERS,
      /* periodMonths */ 12,
      { today, prevSame: ordersPrevSame, prevFull: ordersPrevFull },
    );

    expect(result).toHaveLength(1);
    const row = result[0];

    // current-period sanity check
    expect(row.revenue).toBe(3000);
    expect(row.orderCount).toBe(2);

    // prev same-period metrics
    expect(row.prevYearRevenue).toBe(500);
    expect(row.prevYearOrderCount).toBe(1);
    expect(row.prevYearAvgOrder).toBe(500);
    expect(row.prevYearMarginAmount).toBe(200);
    expect(row.prevYearMarginPercent).toBeCloseTo(40, 2);
    expect(row.prevYearFrequency).not.toBeNull();

    // prev full-year metrics
    expect(row.prevYearRevenueFull).toBe(2000);
    expect(row.prevYearOrderCountFull).toBe(3);
    expect(row.prevYearAvgOrderFull).toBeCloseTo(666.667, 2);
    expect(row.prevYearMarginAmountFull).toBe(800);
    expect(row.prevYearMarginPercentFull).toBeCloseTo(40, 2);
    expect(row.prevYearFrequencyFull).not.toBeNull();
  });

  it('returns null prev-year fields when customer has no prev-year activity', () => {
    const today = new Date('2026-04-17');
    const ordersCurrent = [mkOrder('OC1', '2026-02-01', 1000, 600)];

    const result = groupByDimension(
      'customer',
      ordersCurrent,
      CUSTOMERS,
      12,
      { today, prevSame: [], prevFull: [] },
    );

    expect(result).toHaveLength(1);
    const row = result[0];

    expect(row.prevYearRevenue).toBeNull();
    expect(row.prevYearOrderCount).toBeNull();
    expect(row.prevYearAvgOrder).toBeNull();
    expect(row.prevYearMarginAmount).toBeNull();
    expect(row.prevYearMarginPercent).toBeNull();
    expect(row.prevYearFrequency).toBeNull();
    expect(row.prevYearRevenueFull).toBeNull();
    expect(row.prevYearOrderCountFull).toBeNull();
  });

  it('returns null prev-year fields when prevInput is absent', () => {
    const ordersCurrent = [mkOrder('OC1', '2026-02-01', 1000, 600)];

    const result = groupByDimension(
      'customer',
      ordersCurrent,
      CUSTOMERS,
      12,
      // no prevInput — old callers that haven't been updated yet
    );

    expect(result).toHaveLength(1);
    const row = result[0];

    expect(row.prevYearRevenue).toBeNull();
    expect(row.prevYearRevenueFull).toBeNull();
    expect(row.prevYearOrderCount).toBeNull();
    expect(row.prevYearOrderCountFull).toBeNull();
  });

  it('populates prev-year fields for the zone dimension', () => {
    const today = new Date('2026-04-17');

    const ordersCurrent = [mkOrder('OC1', '2026-02-01', 1000, 600)];
    const ordersPrevSame = [mkOrder('OP1', '2025-02-15', 400, 240)];
    const ordersPrevFull = [
      mkOrder('OP1', '2025-02-15', 400, 240),
      mkOrder('OP2', '2025-09-01', 600, 360),
    ];

    const result = groupByDimension(
      'zone',
      ordersCurrent,
      CUSTOMERS,
      12,
      { today, prevSame: ordersPrevSame, prevFull: ordersPrevFull },
    );

    expect(result).toHaveLength(1);
    const row = result[0];

    expect(row.prevYearRevenue).toBe(400);
    expect(row.prevYearOrderCount).toBe(1);
    expect(row.prevYearMarginAmount).toBeCloseTo(160, 1);
    expect(row.prevYearRevenueFull).toBe(1000);
    expect(row.prevYearOrderCountFull).toBe(2);
  });
});

describe('per-item groupers — prev-year metrics', () => {
  const today = new Date('2026-04-17');
  const mkOrdersForKey = (dim: string, key: string): RawOrder[] =>
    [mkOrder('OC1', '2026-02-01', 1000, 600)].map(o => ({
      ...o,
      ORDERITEMS_SUBFORM: (o.ORDERITEMS_SUBFORM ?? []).map(it => ({
        ...it,
        ...(dim === 'vendor' ? { Y_1159_5_ESH: key } : {}),
        ...(dim === 'brand' ? { Y_9952_5_ESH: key } : {}),
        ...(dim === 'product_type' ? { Y_3020_5_ESH: key } : {}),
        ...(dim === 'product' ? { PARTNAME: key } : {}),
      })),
    }));

  it.each(['vendor', 'brand', 'product_type', 'product'] as const)(
    'populates all 10 new prev-year fields for %s',
    (dim) => {
      const current = mkOrdersForKey(dim, 'K1');
      const prevSame = mkOrdersForKey(dim, 'K1').map(o => ({ ...o, CURDATE: '2025-02-15' }));
      const result = groupByDimension(dim, current, CUSTOMERS, 12,
        { today, prevSame, prevFull: prevSame });
      const row = result.find(r => r.id === 'K1');
      expect(row).toBeDefined();
      expect(row!.prevYearOrderCount).not.toBeNull();
      expect(row!.prevYearAvgOrder).not.toBeNull();
      expect(row!.prevYearMarginAmount).not.toBeNull();
      expect(row!.prevYearMarginPercent).not.toBeNull();
      expect(row!.prevYearFrequency).not.toBeNull();
      expect(row!.prevYearRevenueFull).not.toBeNull();
    },
  );
});
