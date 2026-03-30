// FILE: server/tests/services/dimension-grouper.test.ts
import { describe, it, expect } from 'vitest';
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
