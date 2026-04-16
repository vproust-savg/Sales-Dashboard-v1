// FILE: server/tests/services/dimension-grouper.test.ts
import { describe, it, expect, vi } from 'vitest';
import { groupByDimension } from '../../src/services/dimension-grouper';
import type { RawOrder, RawCustomer } from '../../src/services/priority-queries';

const orders: RawOrder[] = [
  {
    ORDNAME: 'O1', CURDATE: '2026-02-01T00:00:00Z', ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000, CUSTNAME: 'C001', CUSTDES: 'Acme Corp',
    AGENTCODE: 'A01', AGENTDES: 'Sarah M.',
    ORDERITEMS_SUBFORM: [{
      PARTDES: 'Widget', PARTNAME: 'WGT-A', TQUANT: 100,
      QPRICE: 5000, PRICE: 50, PURCHASEPRICE: 30, COST: 30,
      QPROFIT: 2000, PERCENT: 0,
      Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One',
      Y_9952_5_ESH: 'BrandX', Y_3020_5_ESH: 'FAM1',
      Y_3021_5_ESH: 'Packaging', Y_17936_5_ESH: 'VP-001',
    }],
  },
  {
    ORDNAME: 'O2', CURDATE: '2026-02-15T00:00:00Z', ORDSTATUSDES: 'Open',
    TOTPRICE: 5000, CUSTNAME: 'C002', CUSTDES: 'Beta Inc',
    AGENTCODE: 'A01', AGENTDES: 'Sarah M.',
    ORDERITEMS_SUBFORM: [{
      PARTDES: 'Gadget', PARTNAME: 'GDG-B', TQUANT: 50,
      QPRICE: 2500, PRICE: 50, PURCHASEPRICE: 25, COST: 25,
      QPROFIT: 1250, PERCENT: 0,
      Y_1159_5_ESH: 'V02', Y_1530_5_ESH: 'Vendor Two',
      Y_9952_5_ESH: 'BrandX', Y_3020_5_ESH: 'FAM2',
      Y_3021_5_ESH: 'Equipment', Y_17936_5_ESH: 'VP-002',
    }],
  },
];

const customers: RawCustomer[] = [
  { CUSTNAME: 'C001', CUSTDES: 'Acme Corp', ZONECODE: 'Z1', ZONEDES: 'North',
    AGENTCODE: 'A01', AGENTDES: 'Sarah M.', CREATEDDATE: '2021-01-15T00:00:00Z',
    CTYPECODE: 'RT', CTYPEDES: 'Retail' },
  { CUSTNAME: 'C002', CUSTDES: 'Beta Inc', ZONECODE: 'Z2', ZONEDES: 'South',
    AGENTCODE: 'A01', AGENTDES: 'Sarah M.', CREATEDDATE: '2022-06-01T00:00:00Z',
    CTYPECODE: 'WH', CTYPEDES: 'Wholesale' },
];

/** Prev-year orders covering 2 customers across 3 months each. */
function buildPrevYearFixture(): RawOrder[] {
  return [
    { ORDNAME: 'P1', CUSTNAME: 'C001', CURDATE: '2025-01-15T00:00:00Z', ORDSTATUSDES: 'Closed', TOTPRICE: 100, AGENTCODE: 'A', AGENTNAME: 'Agent', ORDERITEMS_SUBFORM: [] },
    { ORDNAME: 'P2', CUSTNAME: 'C001', CURDATE: '2025-05-10T00:00:00Z', ORDSTATUSDES: 'Closed', TOTPRICE: 200, AGENTCODE: 'A', AGENTNAME: 'Agent', ORDERITEMS_SUBFORM: [] },
    { ORDNAME: 'P3', CUSTNAME: 'C001', CURDATE: '2025-09-05T00:00:00Z', ORDSTATUSDES: 'Closed', TOTPRICE: 300, AGENTCODE: 'A', AGENTNAME: 'Agent', ORDERITEMS_SUBFORM: [] },
    { ORDNAME: 'P4', CUSTNAME: 'C002', CURDATE: '2025-02-20T00:00:00Z', ORDSTATUSDES: 'Closed', TOTPRICE: 50, AGENTCODE: 'A', AGENTNAME: 'Agent', ORDERITEMS_SUBFORM: [] },
    { ORDNAME: 'P5', CUSTNAME: 'C002', CURDATE: '2025-04-10T00:00:00Z', ORDSTATUSDES: 'Closed', TOTPRICE: 75, AGENTCODE: 'A', AGENTNAME: 'Agent', ORDERITEMS_SUBFORM: [] },
    { ORDNAME: 'P6', CUSTNAME: 'C002', CURDATE: '2025-11-15T00:00:00Z', ORDSTATUSDES: 'Closed', TOTPRICE: 100, AGENTCODE: 'A', AGENTNAME: 'Agent', ORDERITEMS_SUBFORM: [] },
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
    const entities = groupByDimension('customer', orders, customers, 6, prevOrders, 'ytd');
    const c001 = entities.find(e => e.id === 'C001');
    expect(c001?.prevYearRevenueFull).toBeCloseTo(600, 2);
  });

  it('day-precise YTD cutoff for prevYearRevenue (B-T3)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T00:00:00Z'));
    const prevOrders = buildPrevYearFixture();
    // periodMonths=4 matches April (month 3, index 0..3 = 4 months)
    const entities = groupByDimension('customer', orders, customers, 4, prevOrders, 'ytd');
    const c001 = entities.find(e => e.id === 'C001');
    // C001: Jan15 (month 0 < 3 ✓ +100), May10 (month 4 > 3 ✗), Sep05 (month 8 > 3 ✗) → 100
    expect(c001?.prevYearRevenue).toBeCloseTo(100, 2);
    const c002 = entities.find(e => e.id === 'C002');
    // C002: Feb20 (month 1 < 3 ✓ +50), Apr10 (month 3, date 10 ≤ 15 ✓ +75), Nov15 (month 10 > 3 ✗) → 125
    expect(c002?.prevYearRevenue).toBeCloseTo(125, 2);
    vi.useRealTimers();
  });

  it('non-YTD: prevYearRevenue equals prevYearRevenueFull (B-T4)', () => {
    const prevOrders = buildPrevYearFixture();
    const entities = groupByDimension('customer', orders, customers, 12, prevOrders, '2024');
    entities.forEach(e => {
      expect(e.prevYearRevenue).toBe(e.prevYearRevenueFull);
    });
  });

  it('current-period entity with no prev-year sales returns 0, not null (B-T5)', () => {
    const prevOrders = buildPrevYearFixture();
    const ordersWithNew: RawOrder[] = [
      ...orders,
      { ORDNAME: 'NEW1', CUSTNAME: 'C999', CURDATE: '2026-03-01T00:00:00Z', ORDSTATUSDES: 'Closed', TOTPRICE: 500, AGENTCODE: 'A', AGENTNAME: 'Agent', ORDERITEMS_SUBFORM: [] },
    ];
    const customersWithNew: RawCustomer[] = [
      ...customers,
      { CUSTNAME: 'C999', CUSTDES: 'New Co', ZONECODE: 'Z1', ZONEDES: 'North', AGENTCODE: 'A', AGENTNAME: 'Agent', CREATEDDATE: '2026-01-01', CTYPECODE: 'X', CTYPENAME: 'X' },
    ];
    const entities = groupByDimension('customer', ordersWithNew, customersWithNew, 6, prevOrders, 'ytd');
    const c999 = entities.find(e => e.id === 'C999');
    expect(c999?.prevYearRevenue).toBe(0);
    expect(c999?.prevYearRevenueFull).toBe(0);
  });

  it('aggregate reconciliation: sum of prevYearRevenueFull = sum of prev TOTPRICE (B-T6)', () => {
    const prevOrders = buildPrevYearFixture();
    const entities = groupByDimension('customer', orders, customers, 6, prevOrders, 'ytd');
    const totalEntities = entities.reduce((s, e) => s + (e.prevYearRevenueFull ?? 0), 0);
    const totalPrev = prevOrders.reduce((s, o) => s + o.TOTPRICE, 0);
    expect(totalEntities).toBeCloseTo(totalPrev, 2);
  });

  it('vendor dimension uses item.QPRICE not order.TOTPRICE (B-T7)', () => {
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
    const entities = groupByDimension('vendor', orders, customers, 6, prevWithItems, '2024');
    const v01 = entities.find(e => e.id === 'V01');
    expect(v01?.prevYearRevenueFull).toBeCloseTo(50, 2);
  });

  // B-T8: Structural guard on the entity-list-builder caller contract — the lightweight path
  // MUST NOT pass prevOrders/period to groupByDimension (that would defeat the "no prev fetch"
  // promise). Regression risk: a future developer "helpfully" adds the args, making the cold
  // entity list path require a prev-year fetch. This test fails if that happens.
  // WHY entity-list-builder.ts: entity-stub-builder.ts was deleted in Task 4.3; buildEntityList
  // in entity-list-builder.ts is the new home for all groupByDimension calls in the entity path.
  it('entity-list-builder invokes groupByDimension without prev-year args (B-T8)', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const src = readFileSync(resolve(__dirname, '../../src/services/entity-list-builder.ts'), 'utf8');
    // Match any groupByDimension(...) call; then ensure it has ≤4 positional args (no prev data).
    const calls = src.matchAll(/groupByDimension\s*\(([^)]*)\)/g);
    const found = [...calls];
    expect(found.length).toBeGreaterThan(0);
    found.forEach(m => {
      const argCount = m[1].split(',').filter(s => s.trim().length > 0).length;
      expect(argCount).toBeLessThanOrEqual(4);
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
