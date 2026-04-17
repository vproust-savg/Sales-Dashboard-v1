// FILE: server/tests/services/dimension-grouper.test.ts
import { describe, it, expect } from 'vitest';
import { groupByDimension, type PrevYearInput } from '../../src/services/dimension-grouper';
import type { RawOrder, RawCustomer } from '../../src/services/priority-queries';

const orders: RawOrder[] = [
  {
    ORDNAME: 'O1', CURDATE: '2026-02-01T00:00:00Z', ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000, CUSTNAME: 'C001',
    AGENTCODE: 'A01', AGENTNAME: 'Sarah M.',
    ORDERITEMS_SUBFORM: [{
      PDES: 'Widget', PARTNAME: 'WGT-A', TQUANT: 100, TUNITNAME: 'ea',
      QPRICE: 5000, PRICE: 50, PURCHASEPRICE: 30,
      QPROFIT: 2000, PERCENT: 0,
      Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One',
      Y_9952_5_ESH: 'BrandX', Y_3020_5_ESH: 'FAM1',
      Y_3021_5_ESH: 'Packaging', Y_17936_5_ESH: 'VP-001',
      Y_2075_5_ESH: '', Y_5380_5_ESH: '', Y_9967_5_ESH: '',
    }],
  },
  {
    ORDNAME: 'O2', CURDATE: '2026-02-15T00:00:00Z', ORDSTATUSDES: 'Open',
    TOTPRICE: 5000, CUSTNAME: 'C002',
    AGENTCODE: 'A01', AGENTNAME: 'Sarah M.',
    ORDERITEMS_SUBFORM: [{
      PDES: 'Gadget', PARTNAME: 'GDG-B', TQUANT: 50, TUNITNAME: 'ea',
      QPRICE: 2500, PRICE: 50, PURCHASEPRICE: 25,
      QPROFIT: 1250, PERCENT: 0,
      Y_1159_5_ESH: 'V02', Y_1530_5_ESH: 'Vendor Two',
      Y_9952_5_ESH: 'BrandX', Y_3020_5_ESH: 'FAM2',
      Y_3021_5_ESH: 'Equipment', Y_17936_5_ESH: 'VP-002',
      Y_2075_5_ESH: '', Y_5380_5_ESH: '', Y_9967_5_ESH: '',
    }],
  },
];

const customers: RawCustomer[] = [
  { CUSTNAME: 'C001', CUSTDES: 'Acme Corp', ZONECODE: 'Z1', ZONEDES: 'North',
    AGENTCODE: 'A01', AGENTNAME: 'Sarah M.', CREATEDDATE: '2021-01-15T00:00:00Z',
    CTYPECODE: 'RT', CTYPENAME: 'Retail' },
  { CUSTNAME: 'C002', CUSTDES: 'Beta Inc', ZONECODE: 'Z2', ZONEDES: 'South',
    AGENTCODE: 'A01', AGENTNAME: 'Sarah M.', CREATEDDATE: '2022-06-01T00:00:00Z',
    CTYPECODE: 'WH', CTYPENAME: 'Wholesale' },
];

/** Prev-year orders with items so QPRICE sums correctly. */
function buildPrevYearFixture(): RawOrder[] {
  function mkItem(ordname: string, custname: string, date: string, amount: number): RawOrder {
    return {
      ORDNAME: ordname, CUSTNAME: custname, CURDATE: date, ORDSTATUSDES: 'Closed',
      TOTPRICE: amount, AGENTCODE: 'A', AGENTNAME: 'Agent',
      ORDERITEMS_SUBFORM: [{
        PDES: 'P', PARTNAME: 'X', TQUANT: 1, TUNITNAME: 'ea',
        QPRICE: amount, PRICE: amount, PURCHASEPRICE: 0,
        QPROFIT: 0, PERCENT: 0,
        Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One',
        Y_9952_5_ESH: 'BrandX', Y_3020_5_ESH: 'FAM1', Y_3021_5_ESH: 'Packaging',
        Y_17936_5_ESH: '', Y_2075_5_ESH: '', Y_5380_5_ESH: '', Y_9967_5_ESH: '',
      }],
    };
  }
  return [
    mkItem('P1', 'C001', '2025-01-15T00:00:00Z', 100),
    mkItem('P2', 'C001', '2025-05-10T00:00:00Z', 200),
    mkItem('P3', 'C001', '2025-09-05T00:00:00Z', 300),
    mkItem('P4', 'C002', '2025-02-20T00:00:00Z', 50),
    mkItem('P5', 'C002', '2025-04-10T00:00:00Z', 75),
    mkItem('P6', 'C002', '2025-11-15T00:00:00Z', 100),
  ];
}

describe('groupByDimension prev-year fields (B)', () => {
  it('returns null prev-year fields when prevOrders not provided (B-T1)', () => {
    const entities = groupByDimension('customer', orders, customers, 6);
    entities.forEach(e => {
      expect(e.prevYearRevenue).toBeNull();
      expect(e.prevYearRevenueFull).toBeNull();
    });
  });

  it('prevYearRevenueFull = sum of all prev-year orders for that entity (B-T2)', () => {
    const prevOrders = buildPrevYearFixture();
    const prevInput: PrevYearInput = {
      today: new Date('2026-04-17T00:00:00Z'),
      prevSame: prevOrders,  // caller is responsible for filtering; pass all for full-year test
      prevFull: prevOrders,
    };
    const entities = groupByDimension('customer', orders, customers, 6, prevInput);
    const c001 = entities.find(e => e.id === 'C001');
    expect(c001?.prevYearRevenueFull).toBeCloseTo(600, 2);
  });

  it('day-precise YTD cutoff for prevYearRevenue (B-T3)', () => {
    const today = new Date('2026-04-15T00:00:00Z');
    const prevOrders = buildPrevYearFixture();
    // same-period = Jan–Apr15 only. Filter manually to match what dashboard.ts does.
    const prevSame = prevOrders.filter(o => {
      const d = new Date(o.CURDATE);
      return d.getUTCMonth() < today.getUTCMonth()
        || (d.getUTCMonth() === today.getUTCMonth() && d.getUTCDate() <= today.getUTCDate());
    });
    const prevInput: PrevYearInput = { today, prevSame, prevFull: prevOrders };
    const entities = groupByDimension('customer', orders, customers, 4, prevInput);
    const c001 = entities.find(e => e.id === 'C001');
    // C001: Jan15 (month 0 < 3 ✓ +100), May10 (filtered out), Sep05 (filtered out) → 100
    expect(c001?.prevYearRevenue).toBeCloseTo(100, 2);
    const c002 = entities.find(e => e.id === 'C002');
    // C002: Feb20 (month 1 < 3 ✓ +50), Apr10 (month 3, date 10 ≤ 15 ✓ +75), Nov15 (filtered out) → 125
    expect(c002?.prevYearRevenue).toBeCloseTo(125, 2);
  });

  it('non-YTD: prevYearRevenue equals prevYearRevenueFull (B-T4)', () => {
    const prevOrders = buildPrevYearFixture();
    const prevInput: PrevYearInput = {
      today: new Date('2026-01-01T00:00:00Z'),
      prevSame: prevOrders,  // non-YTD: same = full (all prev orders count as same-period)
      prevFull: prevOrders,
    };
    const entities = groupByDimension('customer', orders, customers, 12, prevInput);
    entities.forEach(e => {
      expect(e.prevYearRevenue).toBe(e.prevYearRevenueFull);
    });
  });

  it('current-period entity with no prev-year sales returns null for prev-year fields (B-T5)', () => {
    // WHY null: new semantics — computeMetrics returns null for empty windows. "No activity
    // vs 0 activity" is now a null/null distinction, not null/0. The per-entity modal
    // renders null as "--" which is correct ("no data available" not "zero sales").
    const prevOrders = buildPrevYearFixture();
    const ordersWithNew: RawOrder[] = [
      ...orders,
      { ORDNAME: 'NEW1', CUSTNAME: 'C999', CURDATE: '2026-03-01T00:00:00Z', ORDSTATUSDES: 'Closed',
        TOTPRICE: 500, AGENTCODE: 'A', AGENTNAME: 'Agent', ORDERITEMS_SUBFORM: [] },
    ];
    const customersWithNew: RawCustomer[] = [
      ...customers,
      { CUSTNAME: 'C999', CUSTDES: 'New Co', ZONECODE: 'Z1', ZONEDES: 'North',
        AGENTCODE: 'A', AGENTNAME: 'Agent', CREATEDDATE: '2026-01-01',
        CTYPECODE: 'X', CTYPENAME: 'X' },
    ];
    const prevInput: PrevYearInput = {
      today: new Date('2026-04-17T00:00:00Z'),
      prevSame: prevOrders,
      prevFull: prevOrders,
    };
    const entities = groupByDimension('customer', ordersWithNew, customersWithNew, 6, prevInput);
    const c999 = entities.find(e => e.id === 'C999');
    // C999 has no prev-year orders → computeMetrics returns null fields for empty buckets
    expect(c999?.prevYearRevenue).toBeNull();
    expect(c999?.prevYearRevenueFull).toBeNull();
  });

  it('aggregate reconciliation: sum of prevYearRevenueFull = sum of prev item QPRICE (B-T6)', () => {
    const prevOrders = buildPrevYearFixture();
    const prevInput: PrevYearInput = {
      today: new Date('2026-04-17T00:00:00Z'),
      prevSame: prevOrders,
      prevFull: prevOrders,
    };
    const entities = groupByDimension('customer', orders, customers, 6, prevInput);
    const totalEntities = entities.reduce((s, e) => s + (e.prevYearRevenueFull ?? 0), 0);
    const totalPrev = prevOrders.reduce((s, o) =>
      s + o.ORDERITEMS_SUBFORM.reduce((is, i) => is + i.QPRICE, 0), 0);
    expect(totalEntities).toBeCloseTo(totalPrev, 2);
  });

  it('vendor dimension: prevYearRevenueFull is populated by Task 4 (B-T7)', () => {
    // WHY: Task 4 wires item-based dims (vendor/brand/product_type/product).
    // prevYearRevenueFull should now be the sum of prev-year item QPRICE for that vendor.
    const prevWithItems: RawOrder[] = [
      {
        ORDNAME: 'PV1', CUSTNAME: 'C001', CURDATE: '2025-06-01T00:00:00Z',
        ORDSTATUSDES: 'Closed', TOTPRICE: 999,
        AGENTCODE: 'A', AGENTNAME: 'Agent',
        ORDERITEMS_SUBFORM: [
          {
            PDES: 'P', PARTNAME: 'X', TQUANT: 1, TUNITNAME: 'ea',
            QPRICE: 50, PRICE: 50, PURCHASEPRICE: 30, QPROFIT: 20, PERCENT: 40,
            Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One', Y_9952_5_ESH: 'B',
            Y_3020_5_ESH: '', Y_3021_5_ESH: '', Y_17936_5_ESH: '', Y_2075_5_ESH: '', Y_5380_5_ESH: '', Y_9967_5_ESH: '',
          },
        ],
      },
    ];
    const prevInput: PrevYearInput = {
      today: new Date('2026-04-17T00:00:00Z'),
      prevSame: prevWithItems,
      prevFull: prevWithItems,
    };
    const entities = groupByDimension('vendor', orders, customers, 6, prevInput);
    const v01 = entities.find(e => e.id === 'V01');
    // Task 4: prevYearRevenueFull = sum of prev-year item QPRICE for vendor V01.
    expect(v01?.prevYearRevenueFull).toBe(50);
    expect(v01?.prevYearOrderCountFull).toBe(1);
    expect(v01?.prevYearMarginAmountFull).toBe(20);
  });

  // B-T8: Structural guard on the entity-list-builder caller contract — the lightweight path
  // MUST NOT pass a real prevInput to groupByDimension (that would defeat the "no prev fetch" promise).
  // WHY ≤6 args now: Task 10 added productsByPartname as 6th optional arg. The 5th arg (prevInput)
  // MUST remain undefined in entity-list-builder — enforced by checking the 5th arg token is 'undefined'.
  it('entity-list-builder invokes groupByDimension without prev-year args (B-T8)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(__dirname, '../../src/services/entity-list-builder.ts'), 'utf8');
    // Match any groupByDimension(...) call; then ensure it has ≤6 positional args.
    const calls = src.matchAll(/groupByDimension\s*\(([^)]*)\)/g);
    const found = [...calls];
    expect(found.length).toBeGreaterThan(0);
    found.forEach(m => {
      const args = m[1].split(',').map(s => s.trim()).filter(s => s.length > 0);
      expect(args.length).toBeLessThanOrEqual(6);
      // 5th arg must be undefined (no prevInput) when present
      if (args.length >= 5) {
        expect(args[4]).toBe('undefined');
      }
    });
  });
});

describe('groupByDimension', () => {
  it('groups by customer — one entity per CUSTNAME', () => {
    const entities = groupByDimension('customer', orders, customers);
    expect(entities).toHaveLength(2);
    expect(entities[0].id).toBe('C001');
    expect(entities[0].name).toBe('Acme Corp');
  });

  it('groups by vendor — one entity per Y_1159_5_ESH', () => {
    const entities = groupByDimension('vendor', orders, customers);
    expect(entities).toHaveLength(2);
    expect(entities.find(e => e.id === 'V01')?.name).toBe('Vendor One');
  });

  it('groups by brand — one entity per Y_9952_5_ESH', () => {
    const entities = groupByDimension('brand', orders, customers);
    expect(entities).toHaveLength(1); // Both orders have BrandX
    expect(entities[0].name).toBe('BrandX');
    expect(entities[0].revenue).toBe(7500);
  });

  it('sorts by revenue descending by default', () => {
    const entities = groupByDimension('customer', orders, customers);
    expect(entities[0].revenue).toBeGreaterThanOrEqual(entities[1].revenue);
  });
});
