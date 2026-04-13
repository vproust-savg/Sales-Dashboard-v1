// FILE: server/tests/services/customer-filter.test.ts
// PURPOSE: Tests for post-fetch filtering of orders by customer-level criteria (zone, customerType)
// USED BY: CI pipeline
// EXPORTS: none (test file)

import { describe, it, expect } from 'vitest';
import { filterOrdersByCustomerCriteria } from '../../src/services/customer-filter';
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
  makeCustomer({ CUSTNAME: 'C001', ZONEDES: 'North', CTYPENAME: 'Retail' }),
  makeCustomer({ CUSTNAME: 'C002', ZONEDES: 'South', CTYPENAME: 'Wholesale' }),
  makeCustomer({ CUSTNAME: 'C003', ZONEDES: 'North', CTYPENAME: 'Wholesale' }),
];

const orders: RawOrder[] = [
  makeOrder({ ORDNAME: 'O1', CUSTNAME: 'C001' }),
  makeOrder({ ORDNAME: 'O2', CUSTNAME: 'C002' }),
  makeOrder({ ORDNAME: 'O3', CUSTNAME: 'C003' }),
];

describe('filterOrdersByCustomerCriteria', () => {
  it('returns all orders when no criteria set', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, {});
    expect(result).toHaveLength(3);
  });

  it('filters by zone — single zone', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { zone: 'North' });
    expect(result).toHaveLength(2);
    expect(result.map(o => o.CUSTNAME).sort()).toEqual(['C001', 'C003']);
  });

  it('filters by zone — multiple zones (OR within type)', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { zone: 'North,South' });
    expect(result).toHaveLength(3);
  });

  it('filters by customerType — single type', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { customerType: 'Retail' });
    expect(result).toHaveLength(1);
    expect(result[0].CUSTNAME).toBe('C001');
  });

  it('filters by customerType — multiple types (OR within type)', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { customerType: 'Retail,Wholesale' });
    expect(result).toHaveLength(3);
  });

  it('AND logic across zone + customerType', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, {
      zone: 'North',
      customerType: 'Wholesale',
    });
    expect(result).toHaveLength(1);
    expect(result[0].CUSTNAME).toBe('C003');
  });

  it('is case-insensitive', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { zone: 'north' });
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no customers match', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { zone: 'West' });
    expect(result).toHaveLength(0);
  });

  it('handles whitespace in comma-separated values', () => {
    const result = filterOrdersByCustomerCriteria(orders, customers, { zone: ' North , South ' });
    expect(result).toHaveLength(3);
  });
});
