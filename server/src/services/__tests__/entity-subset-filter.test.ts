// FILE: server/src/services/__tests__/entity-subset-filter.test.ts
// PURPOSE: Tests for scopeOrders — verifies correct order/item scoping per dimension
//   and TOTPRICE rewrite for item-based dims.
// USED BY: vitest test suite
// EXPORTS: (test file)

import { describe, it, expect } from 'vitest';
import { scopeOrders } from '../entity-subset-filter.js';
import type { RawOrder, RawCustomer } from '../priority-queries.js';

const customers: RawCustomer[] = [
  { CUSTNAME: 'C1', CUSTDES: 'Cust1', ZONECODE: 'Z1', ZONEDES: 'Zone1', AGENTCODE: 'A', AGENTNAME: 'Alice', CREATEDDATE: '', CTYPECODE: 'T', CTYPENAME: 'T' },
  { CUSTNAME: 'C2', CUSTDES: 'Cust2', ZONECODE: 'Z2', ZONEDES: 'Zone2', AGENTCODE: 'A', AGENTNAME: 'Alice', CREATEDDATE: '', CTYPECODE: 'T', CTYPENAME: 'T' },
];
const baseItem = { PDES: '', TQUANT: 0, TUNITNAME: '', QPRICE: 0, PRICE: 0, PURCHASEPRICE: 0, QPROFIT: 0, PERCENT: 0, Y_17936_5_ESH: '', Y_2075_5_ESH: '', Y_5380_5_ESH: '', Y_9967_5_ESH: '' };
const makeOrder = (ordname: string, custname: string, items: Partial<typeof baseItem & { PARTNAME: string; Y_1159_5_ESH?: string; Y_9952_5_ESH?: string; Y_3020_5_ESH?: string; Y_3021_5_ESH?: string; Y_1530_5_ESH?: string }>[]): RawOrder => ({
  ORDNAME: ordname, CURDATE: '2026-01-01T00:00:00Z', ORDSTATUSDES: 'Open', TOTPRICE: items.reduce((s, i) => s + (i.QPRICE || 0), 0),
  CUSTNAME: custname, AGENTCODE: 'A', AGENTNAME: 'Alice',
  ORDERITEMS_SUBFORM: items.map(i => ({ ...baseItem, PARTNAME: 'P1', Y_1159_5_ESH: '', Y_1530_5_ESH: '', Y_9952_5_ESH: '', Y_3020_5_ESH: '', Y_3021_5_ESH: '', ...i })),
});

describe('scopeOrders', () => {
  it('customer dim: filters orders by CUSTNAME, keeps items unchanged, TOTPRICE unchanged', () => {
    const orders = [makeOrder('O1', 'C1', [{ QPRICE: 100 }]), makeOrder('O2', 'C2', [{ QPRICE: 200 }])];
    const scoped = scopeOrders(orders, 'customer', new Set(['C1']), customers);
    expect(scoped).toHaveLength(1);
    expect(scoped[0].ORDNAME).toBe('O1');
    expect(scoped[0].TOTPRICE).toBe(100);
    expect(scoped[0].ORDERITEMS_SUBFORM).toHaveLength(1);
  });

  it('zone dim: filters orders by customer zone, keeps items unchanged', () => {
    const orders = [makeOrder('O1', 'C1', [{ QPRICE: 100 }]), makeOrder('O2', 'C2', [{ QPRICE: 200 }])];
    const scoped = scopeOrders(orders, 'zone', new Set(['Z1']), customers);
    expect(scoped).toHaveLength(1);
    expect(scoped[0].ORDNAME).toBe('O1');
    expect(scoped[0].TOTPRICE).toBe(100);
  });

  it('vendor dim: narrows items and rewrites TOTPRICE = Σ QPRICE of matching items', () => {
    const orders = [
      makeOrder('O1', 'C1', [
        { Y_1159_5_ESH: 'V1', QPRICE: 100 },
        { Y_1159_5_ESH: 'V2', QPRICE: 200 },
        { Y_1159_5_ESH: 'V3', QPRICE: 50 },
      ]),
    ];
    const scoped = scopeOrders(orders, 'vendor', new Set(['V1', 'V2']), customers);
    expect(scoped).toHaveLength(1);
    expect(scoped[0].ORDERITEMS_SUBFORM).toHaveLength(2);
    expect(scoped[0].TOTPRICE).toBe(300);
  });

  it('vendor dim: drops orders with no matching items', () => {
    const orders = [
      makeOrder('O1', 'C1', [{ Y_1159_5_ESH: 'V1', QPRICE: 100 }]),
      makeOrder('O2', 'C2', [{ Y_1159_5_ESH: 'V3', QPRICE: 200 }]),
    ];
    const scoped = scopeOrders(orders, 'vendor', new Set(['V1']), customers);
    expect(scoped.map(o => o.ORDNAME)).toEqual(['O1']);
  });

  it('product_type dim: matches on Y_3020_5_ESH', () => {
    const orders = [makeOrder('O1', 'C1', [
      { Y_3020_5_ESH: '01', Y_3021_5_ESH: 'Culinary', QPRICE: 100 },
      { Y_3020_5_ESH: '02', Y_3021_5_ESH: 'Pastry', QPRICE: 50 },
    ])];
    const scoped = scopeOrders(orders, 'product_type', new Set(['01']), customers);
    expect(scoped[0].ORDERITEMS_SUBFORM).toHaveLength(1);
    expect(scoped[0].TOTPRICE).toBe(100);
  });

  it('product_type dim: falls back to Y_3021_5_ESH when Y_3020_5_ESH is empty', () => {
    const orders = [makeOrder('O1', 'C1', [
      { Y_3020_5_ESH: '',  Y_3021_5_ESH: 'Culinary', QPRICE: 100 },
      { Y_3020_5_ESH: '',  Y_3021_5_ESH: 'Pastry',   QPRICE: 50 },
    ])];
    const scoped = scopeOrders(orders, 'product_type', new Set(['Culinary']), customers);
    expect(scoped[0].ORDERITEMS_SUBFORM).toHaveLength(1);
    expect(scoped[0].TOTPRICE).toBe(100);
  });

  it('product dim: matches on PARTNAME', () => {
    const orders = [makeOrder('O1', 'C1', [
      { PARTNAME: 'P1', QPRICE: 100 },
      { PARTNAME: 'P2', QPRICE: 50 },
    ])];
    const scoped = scopeOrders(orders, 'product', new Set(['P1']), customers);
    expect(scoped[0].ORDERITEMS_SUBFORM.map(i => i.PARTNAME)).toEqual(['P1']);
    expect(scoped[0].TOTPRICE).toBe(100);
  });

  it('empty entityIds returns empty array', () => {
    const orders = [makeOrder('O1', 'C1', [{ QPRICE: 100 }])];
    expect(scopeOrders(orders, 'customer', new Set(), customers)).toEqual([]);
  });
});
