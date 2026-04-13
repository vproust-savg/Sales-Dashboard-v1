// FILE: server/tests/services/entity-filter.test.ts
// PURPOSE: Tests for dimension-aware order filtering used by consolidated view
// USED BY: CI / vitest
// EXPORTS: none

import { describe, it, expect, vi } from 'vitest';

// WHY: dashboard.ts imports Redis, fetch, and other services.
// We must mock these before importing the function under test.
vi.mock('../../src/cache/redis-client', () => ({
  redis: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue('OK') },
}));
vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
  new Response(JSON.stringify({ value: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
));
vi.mock('../../src/services/priority-instance', () => ({
  priorityClient: {},
}));

import { filterOrdersByEntityIds } from '../../src/routes/dashboard';
import type { RawOrder, RawOrderItem, RawCustomer } from '../../src/services/priority-queries';

function makeItem(overrides: Partial<RawOrderItem> = {}): RawOrderItem {
  return {
    PDES: 'Widget A', PARTNAME: 'WGT-A', TQUANT: 100, TUNITNAME: 'ea',
    QPRICE: 5000, PRICE: 50, PURCHASEPRICE: 30, QPROFIT: 2000, PERCENT: 40,
    Y_1159_5_ESH: 'V01', Y_1530_5_ESH: 'Vendor One', Y_9952_5_ESH: 'BrandX',
    Y_3020_5_ESH: 'FAM1', Y_3021_5_ESH: 'Packaging', Y_17936_5_ESH: 'VP-001',
    Y_2075_5_ESH: 'Family A', Y_5380_5_ESH: 'USA', Y_9967_5_ESH: 'N',
    ...overrides,
  };
}

function makeOrder(overrides: Partial<RawOrder> = {}): RawOrder {
  return {
    ORDNAME: 'ORD-001', CURDATE: '2026-02-15T00:00:00Z', ORDSTATUSDES: 'Closed',
    TOTPRICE: 10000, CUSTNAME: 'C001', AGENTCODE: 'A01', AGENTNAME: 'Sarah M.',
    ORDERITEMS_SUBFORM: [makeItem()],
    ...overrides,
  };
}

function makeCustomer(overrides: Partial<RawCustomer> = {}): RawCustomer {
  return {
    CUSTNAME: 'C001', CUSTDES: 'Acme Corp', ZONECODE: 'Z1', ZONEDES: 'North',
    AGENTCODE: 'A01', AGENTNAME: 'Sarah M.', CREATEDDATE: '2021-01-15T00:00:00Z',
    CTYPECODE: 'RT', CTYPENAME: 'Retail',
    ...overrides,
  };
}

const customers: RawCustomer[] = [
  makeCustomer({ CUSTNAME: 'C001', ZONECODE: 'Z1' }),
  makeCustomer({ CUSTNAME: 'C002', ZONECODE: 'Z2' }),
  makeCustomer({ CUSTNAME: 'C003', ZONECODE: 'Z1' }),
];

const orders: RawOrder[] = [
  makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C001' }),
  makeOrder({ ORDNAME: 'O2', CUSTNAME: 'C002' }),
  makeOrder({ ORDNAME: 'O3', CUSTNAME: 'C003' }),
];

describe('filterOrdersByEntityIds', () => {
  it('filters by CUSTNAME for customer dimension', () => {
    const result = filterOrdersByEntityIds(orders, new Set(['C001', 'C003']), 'customer', customers);
    expect(result).toHaveLength(2);
    expect(result.map(o => o.ORDNAME).sort()).toEqual(['O1', 'O3']);
  });

  it('filters by zone — includes orders from all customers in matching zones', () => {
    const result = filterOrdersByEntityIds(orders, new Set(['Z1']), 'zone', customers);
    expect(result).toHaveLength(2);
    expect(result.map(o => o.CUSTNAME).sort()).toEqual(['C001', 'C003']);
  });

  it('filters by vendor — matches item Y_1159_5_ESH', () => {
    const vendorOrders = [
      makeOrder({
        ORDNAME: 'O1',
        ORDERITEMS_SUBFORM: [makeItem({ Y_1159_5_ESH: 'V01' }), makeItem({ Y_1159_5_ESH: 'V02' })],
      }),
      makeOrder({
        ORDNAME: 'O2',
        ORDERITEMS_SUBFORM: [makeItem({ Y_1159_5_ESH: 'V02' })],
      }),
    ];
    const result = filterOrdersByEntityIds(vendorOrders, new Set(['V01']), 'vendor', customers);
    expect(result).toHaveLength(1);
    expect(result[0].ORDNAME).toBe('O1');
  });

  it('filters by brand — matches item Y_9952_5_ESH', () => {
    const brandOrders = [
      makeOrder({ ORDNAME: 'O1', ORDERITEMS_SUBFORM: [makeItem({ Y_9952_5_ESH: 'BrandX' })] }),
      makeOrder({ ORDNAME: 'O2', ORDERITEMS_SUBFORM: [makeItem({ Y_9952_5_ESH: 'BrandY' })] }),
    ];
    const result = filterOrdersByEntityIds(brandOrders, new Set(['BrandX']), 'brand', customers);
    expect(result).toHaveLength(1);
    expect(result[0].ORDNAME).toBe('O1');
  });

  it('filters by product_type — matches item Y_3020_5_ESH code', () => {
    const typeOrders = [
      makeOrder({ ORDNAME: 'O1', ORDERITEMS_SUBFORM: [makeItem({ Y_3020_5_ESH: 'FAM1' })] }),
      makeOrder({ ORDNAME: 'O2', ORDERITEMS_SUBFORM: [makeItem({ Y_3020_5_ESH: 'FAM2' })] }),
    ];
    const result = filterOrdersByEntityIds(typeOrders, new Set(['FAM1']), 'product_type', customers);
    expect(result).toHaveLength(1);
    expect(result[0].ORDNAME).toBe('O1');
  });

  it('filters by product — matches item PARTNAME', () => {
    const productOrders = [
      makeOrder({ ORDNAME: 'O1', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'WGT-A' }), makeItem({ PARTNAME: 'GDG-B' })] }),
      makeOrder({ ORDNAME: 'O2', ORDERITEMS_SUBFORM: [makeItem({ PARTNAME: 'GDG-B' })] }),
    ];
    const result = filterOrdersByEntityIds(productOrders, new Set(['WGT-A']), 'product', customers);
    expect(result).toHaveLength(1);
    expect(result[0].ORDNAME).toBe('O1');
  });
});
