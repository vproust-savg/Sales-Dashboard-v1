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

// WHY: Codex post-deploy finding — prevYearFrequency was divided by day count (~107 days YTD),
// prevYearFrequencyFull by 365 days, while current-period frequency uses months. Both values
// must now use months so all three frequency values are comparable on the /mo scale.
describe('prevYearFrequency uses months — Codex post-deploy fix', () => {
  it('YTD same-period and full-year frequencies are DIFFERENT (1 vs 3 orders over different windows)', () => {
    const today = new Date('2026-04-17');
    // same-period window: ~3.5 months (Jan–Apr 17). 1 order → ~1/3.5 ≈ 0.286/mo
    // full-year window: 12 months. 3 orders → 3/12 = 0.25/mo
    const ordersPrevSame = [mkOrder('OP1', '2025-02-15', 500, 300)];
    const ordersPrevFull = [
      mkOrder('OP1', '2025-02-15', 500, 300),
      mkOrder('OP2', '2025-06-10', 800, 500),
      mkOrder('OP3', '2025-11-20', 700, 400),
    ];
    const ordersCurrent = [mkOrder('OC1', '2026-02-01', 1000, 600)];

    const result = groupByDimension(
      'customer', ordersCurrent, CUSTOMERS, 12,
      { today, prevSame: ordersPrevSame, prevFull: ordersPrevFull },
    );

    const row = result[0];
    expect(row.prevYearFrequency).not.toBeNull();
    expect(row.prevYearFrequencyFull).not.toBeNull();

    // They must not be equal — same data divided by different month windows
    expect(row.prevYearFrequency).not.toBeCloseTo(row.prevYearFrequencyFull!, 5);

    // Both must be in orders/month range (not orders/day).
    // 1 order / ~3.5 months ≈ 0.286; 3 orders / 12 months = 0.25
    // The day-based bug would yield 1/107 ≈ 0.009 and 3/365 ≈ 0.008 — both < 0.05.
    expect(row.prevYearFrequency!).toBeGreaterThan(0.05);
    expect(row.prevYearFrequencyFull!).toBeGreaterThan(0.05);

    // full-year: exactly 3 orders / 12 months = 0.25
    expect(row.prevYearFrequencyFull).toBeCloseTo(3 / 12, 4);

    // same-period: 1 order / months-elapsed (Jan 1 → Apr 17 = ~3.55 months)
    // months = (today - Jan 1) / avg days per month. Verify it's close to 1/3.55
    const monthsElapsed = (today.getTime() - new Date(Date.UTC(2026, 0, 1)).getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
    expect(row.prevYearFrequency).toBeCloseTo(1 / monthsElapsed, 3);
  });

  it('current-period frequency and prevYearFrequency are on the same /month scale', () => {
    const today = new Date('2026-04-17');
    const periodMonths = today.getUTCMonth() + 1; // 4 months YTD

    // Current: 2 orders in 4 months → 0.5/mo
    const ordersCurrent = [
      mkOrder('OC1', '2026-02-01', 1000, 600),
      mkOrder('OC2', '2026-03-01', 2000, 1200),
    ];
    // Prev same-period (Jan–Apr): 1 order → ~1/3.55 months
    const ordersPrevSame = [mkOrder('OP1', '2025-02-15', 500, 300)];

    const result = groupByDimension(
      'customer', ordersCurrent, CUSTOMERS, periodMonths,
      { today, prevSame: ordersPrevSame, prevFull: ordersPrevSame },
    );
    const row = result[0];

    // Current frequency: 2 / 4 = 0.5/mo — the reference unit
    expect(row.frequency).toBeCloseTo(2 / 4, 5);

    // prevYearFrequency must be in the same ballpark (both /mo), not 30x smaller
    // prev: 1 / ~3.55 months ≈ 0.282. Current: 2/4 = 0.5. Ratio should be < 3, not ~30.
    const ratio = row.frequency! / row.prevYearFrequency!;
    expect(ratio).toBeLessThan(3);
    expect(ratio).toBeGreaterThan(0.1);
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
